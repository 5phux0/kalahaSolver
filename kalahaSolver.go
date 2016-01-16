package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"github.com/5phux0/kalahago"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"
	"unicode"
)

var awd string
var sessions map[string]session
var pageTemplate *template.Template

type historyState struct {
	Pholes    []int  `json:"pholes"`
	Oholes    []int  `json:"oholes"`
	Pscore    int    `json:"pscore"`
	Oscore    int    `json:"oscore"`
	Mover     bool   `json:"mover"`
	LastMover bool   `json:"lastMover"`
	Action    string `json:"action"`
}

type session struct {
}

func main() {
	var err error
	awd, err = os.Getwd()
	ef(err)
	sessions = make(map[string]session, 100)
	pageTemplate, err = template.ParseFiles(awd + "/templates/template.html")
	ef(err)
	http.HandleFunc("/", pageHandler)
	http.HandleFunc("/ajax", xhrHandler)
	http.Handle("/file/", http.StripPrefix("/file/", http.FileServer(http.Dir(awd+"/files/"))))
	fmt.Println("Setup done")
	log.Fatal(http.ListenAndServe(":80", nil))
}

func pageHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	//Usefull when testing
	var err error
	pageTemplate, err = template.ParseFiles(awd + "/templates/template.html")
	ef(err)

	token := ""
	for e := true; e; _, e = sessions[token] {
		token = newSessionToken()
	}
	sessions[token] = session{}

	pageTemplate.Execute(w, token)
}

func xhrHandler(w http.ResponseWriter, r *http.Request) {
	type ajaxRequest struct {
		Task           string
		Pholes, Oholes []float64
		Pscore, Oscore float64
		Mover          bool
	}
	buff, err := ioutil.ReadAll(r.Body)
	ef(err)
	err = r.Body.Close()
	ef(err)
	req := new(ajaxRequest)
	err = json.Unmarshal(buff, &req)
	ef(err)

	if len(req.Pholes) != len(req.Oholes) {
		panic("Uneven number of holes")
	}
	pside := make([]int, len(req.Pholes)+1)
	oside := make([]int, len(req.Pholes)+1)
	for i := 0; i < len(req.Pholes); i++ {
		pside[i] = int(req.Pholes[i])
		oside[i] = int(req.Oholes[i])
	}
	pside[len(pside)-1] = int(req.Pscore)
	oside[len(oside)-1] = int(req.Oscore)
	holes := make([]int, 2*len(req.Pholes)+2)
	if req.Mover {
		copy(holes, pside)
		copy(holes[len(pside):], oside)
	} else {
		copy(holes, oside)
		copy(holes[len(oside):], pside)
	}

	response := map[string]interface{}{}

Task:
	switch req.Task {
	case "getWinPath":
		board := kalahago.BoardFromHoles(holes)
		tree, err := board.SearchWinPath(15 * time.Second)
		defer tree.Free()
		defer board.Free()
		mes := fmt.Sprintf("%v moves evaluated. ", board.GetMoveCount())
		if err != nil {
			response["outcome"] = mes + "Calculation time limit of 15 seconds exceeded"
			break Task
		}
		state, path, err := tree.GetWinningPath()
		ef(err)
		switch state {
		case kalahago.State_NoWin:
			response["outcome"] = mes + "No winning moves possible"
			break Task
		case kalahago.State_HasWon:
			response["outcome"] = mes + "You have already won"
			break Task
		case kalahago.State_WinningTurn:
			response["outcome"] = mes + "Winning possible current turn"
		case kalahago.State_WillWin:
			response["outcome"] = mes + "Winning possible in following turns"
		}
		states := getHistoryStatesForMovePath(board, path, req.Mover)
		response["states"] = states
	default:
		panic("Invalid task")
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(response)
}

func getHistoryStatesForMovePath(b kalahago.Board, path []int, firstMover bool) []historyState {
	states := make([]historyState, len(path))
	nb := b.Copy()
	lastMover := firstMover

	for i, v := range path {
		nb.Pickup(v)
		bs, err := nb.GetState()
		ef(err)
		if m := bs.Mover == firstMover; m {
			states[i] = historyState{bs.Pholes, bs.Oholes, bs.Pscore,
				bs.Oscore, m, lastMover, fmt.Sprint(v + 1)}
			lastMover = bs.Mover
		} else {
			states[i] = historyState{bs.Oholes, bs.Pholes, bs.Oscore,
				bs.Pscore, m, lastMover, fmt.Sprint(v + 1)}
			lastMover = !bs.Mover
		}
	}

	return states
}

func newSessionToken() string {
	var buf bytes.Buffer
	buf.Grow(12)

	bs := make([]byte, 1)
	for buf.Len() < 12 {
		for {
			_, err := rand.Read(bs)
			ef(err)
			if b := urlhtmlSafeByte(bs[0]); b != 0 {
				buf.WriteByte(b)
				break
			}
		}
	}
	return buf.String()
}

func urlhtmlSafeByte(r byte) byte {
	if r > 127 {
		r /= 2
	}
	if unicode.IsDigit(rune(r)) || unicode.IsLetter(rune(r)) || r == '$' || r == '-' ||
		r == '_' || r == '.' || r == '!' || r == '*' || r == '(' || r == ')' {
		return r
	} else {
		return 0
	}
}

func ef(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
