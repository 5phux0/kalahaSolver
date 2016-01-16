hole = '<td><div><input type="text" class="hole" onblur="validateHole(event)"></input></div></td>';

var editing = true;
var token = $("meta[name='sessionToken']").prop("value");
var dropDelay;
var mover;
var dropFunc;
var dropTimer;
var lastHole;
var historyArray = new Array();
var historyIndex;
var lastMovedIndex;
var lastMover;

$(document).ready(function(){
	setBoardState({
		pholes: [6, 6, 6, 6, 6, 6],
		pscore: 0,
		oholes: [6, 6, 6, 6, 6, 6],
		oscore: 0,
		mover: true
	});
});

function toggleEditing(){
	editing = !editing;
	if(editing){
		moveEnd();
		$(".hole, .home").prop("readonly", false);
		$(".edit-controll").prop("disabled", false);
		$("#toggleEditingButton").prop("value", "Lock");
		clearHistory();
		disableMoving();
	}else{
		$(".hole, .home").prop("readonly", true);
		$(".edit-controll").prop("disabled", true);
		$("#toggleEditingButton").prop("value", "Edit");
		mover = $(".edit-controll[name='turnHolder']").filter(":checked").val() == "true";
		clearHistory();
		addStateToHistory("Go!", null);
		enableMoving();
	}
}

function clearHistory(){
	historyIndex = -1;
	historyArray.length = 0;
	updateHistoryView();
}

function addStateToHistory(action, latestMover){
	historyIndex++;
	active = historyArray[historyIndex];
	if(!(typeof active !== "undefined" && active.action == action)){
		state = currentBoardState();
		state.lastMover = latestMover;
		state.action = action;
		historyArray.splice(historyIndex, historyArray.length, state);
	}
	updateHistoryView();
}

function currentBoardState(){
	state ={
			pholes: [],
			pscore: +$("#phome").val(),
			oholes: [],
			oscore: +$("#ohome").val(),
			mover: mover,
	};
	pholes = $("#prow .hole");
	for(h of pholes){
		state.pholes.push(+$(h).val());
	}
	oholes = $("#orow .hole");
	for(h of oholes){
		state.oholes.unshift(+$(h).val());
	}
	return state;
}

function updateHistoryView(){
	historyView = $(".history-view").first().empty();
	for(i = 0; i<historyArray.length; i++){
		s = historyArray[i];
		elem = $('<div>', {
		    class: "history-element clickable",
		    text: s.action,
		});
		if(s.lastMover == true){
			$(elem).addClass("orange");
		}else if(s.lastMover == false){
			$(elem).addClass("teal");
		}
		if(i > historyIndex){
			$(elem).addClass("greyed");
		}
		$(elem).click(function(event){
			historyGoto($(".history-view .history-element").index(event.target));
		});
		elem.appendTo(historyView);
	}
}

function historyGoto(index){
	historyIndex = index;
	state = historyArray[historyIndex];
	if(typeof state !== "undefined"){
		setBoardState(state);
	}
	updateHistoryView();
}

function enableMoving(){
	disableMoving();
	gtz = function(){
		return $(this).val() > 0;
	};

	if(mover){
		$("#prow .hole").filter(gtz).click(moveStart).addClass("movable");
	}else{
		$("#orow .hole").filter(gtz).click(moveStart).addClass("movable");
	}
}

function disableMoving(){
	$(".hole").unbind();
	$(".hole").removeClass("movable");
}

function setBoardState(boardState){
	var s;
	prow = $("#prow tr");
	prow.empty();
	i = 1;
	for (s of boardState.pholes) {
		prow.append(hole).find("td").last().append(i++).find("input").val(s);
	}
	orow = $("#orow tr");
	orow.empty();
	i = 1;
	for (s of boardState.oholes) {
		orow.prepend(hole).find("td").first().prepend(i++).find("input").val(s);
	}

	$("#phome").prop("value", boardState.pscore);
	$("#ohome").prop("value", boardState.oscore);
	$("#numberOfHoles").val(boardState.pholes.length);
	$("#numberOfStones").val(boardState.pholes[0]);
	$(".edit-controll[name='turnHolder']").val([boardState.mover]);

	mover = boardState.mover;
	if(!editing){
		enableMoving();
		$(".hole, .home").prop("readonly", true);
	}
}

function moveStart(event){
	disableMoving();
	dropDelay = 500;
	$(".board").click(function(event){
		dropDelay = 0;
		clearInterval(dropTimer);
		dropTimer = setInterval(dropFunc, dropDelay);
	});
	dropFunc = pickup(event.target);
	dropTimer = setInterval(dropFunc, dropDelay);
	return false;
}

function stealStones(thief){
	var side;
	var home;
	var i=0;
	var hand=0;

	if(thief){
		side = $("#orow .hole");
		home = $("#phome").first();
	}else{
		side = $("#prow .hole");
		home = $("#ohome").first();
	}

	dropFunc = function(){
		for(;i<side.length;i++){
			h = $(side[i]);
			if(h.val() > 0){
				hand += (+h.val());
				h.val(0);
				lastHole.removeClass("bflash").removeClass("rflash");
				h.addClass("rflash");
				lastHole = h;
				i++;
				return;
			}
		}
		home.val(+home.val()+hand);
		lastHole.removeClass("bflash").removeClass("rflash");
		home.addClass("bflash");
		moveEnd();
	}
	dropTimer = setInterval(dropFunc, dropDelay)
}

function moveEnd(){
	clearInterval(dropTimer);
	dropTimer = undefined;
	prow = $("#prow .hole");
	orow = $("#orow .hole");
	psteal = true;
	osteal = true;
	for(h of prow){
		if($(h).val() > 0){
			psteal = false;
			break;
		}
	}
	for(h of orow){
		if($(h).val() > 0){
			osteal = false;
			break;
		}
	}
	if(psteal && !osteal){
		stealStones(true);
		return;
	}
	if(osteal && !psteal){
		stealStones(false);
		return;
	}

	if(!editing){
		enableMoving();
	}
	$(".board").unbind();
	addStateToHistory(lastMovedIndex, lastMover);
}

function pickup(hole){
	mover = ($(hole).parents("#prow").length > 0);
	prow = $("#prow .hole");
	orow = $("#orow .hole");
	phome = $("#phome").first();
	ohome = $("#ohome").first();
	direction = mover ? 1 : -1; 
	if (mover){
		currentSide = prow;
		lastMovedIndex = $(currentSide).index(hole)+1;
	}else{
		currentSide = orow;
		lastMovedIndex = prow.length-$(currentSide).index(hole);
	}
	i = $(currentSide).index(hole)+direction;
	hand = $(hole).val();
	$(hole).val(0);
	if(typeof lastHole !== "undefined"){
		lastHole.removeClass("bflash").removeClass("rflash");
	}
	lastHole = $(hole);
	$(hole).addClass("rflash");

	lastMover = mover;

	return function(){
		if(hand == 0){
			if(lastHole == phome || lastHole == ohome){
				moveEnd();
				return;
			}
			if($(lastHole).val() == 1){
				mover = !mover;
				moveEnd();
				return;
			}
			if(dropDelay > 0){
				$(lastHole).addClass("rflash");
			}
			lastHole.removeClass("bflash");
			hand = $(lastHole).val();
			$(lastHole).val(0);
			return;
		}
		if(i>=0 && i<currentSide.length){
			drop($(currentSide).eq(i));
			hand--;
		}else{
			direction = -direction;
			if(currentSide == prow){
				currentSide = orow;
			}else{
				currentSide = prow;
			}
			if(mover && direction == -1){
				drop(phome);
			}else if(!mover && direction == 1){
				drop(ohome);
			}else{
				i += direction;
				dropFunc();
				return;
			}
			hand--;
		}
		i += direction;
	}
}

function drop(hole){
	$(hole).val(+$(hole).val()+1);
	if(dropDelay > 0){
		$(hole).addClass("bflash");
	}
	lastHole.removeClass("bflash").removeClass("rflash");
	lastHole = hole;
}

function getWinPath(){
	if(editing){
		toggleEditing();
	}
	if(typeof dropTimer !== "undefined"){
		moveEnd();
		historyArray.splice(historyIndex);
		historyGoto(historyIndex-1);
	}
	disableMoving();
	$("#htwButton").prop("disabled", true);
	$("#toggleEditingButton").prop("disabled", true);
	$(".loading-indicator").show();
	$(".history-element").removeClass("clickable").unbind();
	postedState = Object.assign({}, historyArray[historyIndex]);
	postedState.task = "getWinPath";
	delete postedState.lastMover;
	delete postedState.action;
	$.post("/ajax", JSON.stringify(postedState))
	.always(function(){
		$("#htwButton").prop("disabled", false);
		$("#toggleEditingButton").prop("disabled", false);
		$(".loading-indicator").hide();
		$(".history-element").addClass("clickable").click(function(event){
			historyGoto($(".history-view .history-element").index(event.target));
		});
		enableMoving();
	}).fail(function(data){
		console.log("Ajax-request error:", data);
		$(".result-message").text("Request failed. Details in log.");
	}).done(function(data){
		response = JSON.parse(data);
		if(typeof response.states !== "undefined"){
			historyArray.splice(historyIndex+1);
			historyArray = historyArray.concat(response.states);
			updateHistoryView();
		}
		$(".history-view").append($('<div>', {
		    class: "result-message",
		    text: response.outcome,
		}));
	});
}

function validateHole(event){
	event.target.value = parseInt(event.target.value);
	if (!(event.target.value >= 0)){
		event.target.value = 0;
	}
}

function nHolesChanged(event){
	v = parseInt(event.target.value);
	if (!(v >= 1)){
		v = 1;
	}else if(v > 12){
		v = 12;
	}
	event.target.value = v;

	state = currentBoardState();
	if(v < state.pholes.length){
		state.pholes.splice(v);
		state.oholes.splice(v);
	}else if(v > state.pholes.length){
		nstones = +$("#numberOfStones").val();
		addarr = [];
		for(i = state.pholes.length; i<v; i++){
			addarr.push(nstones);
		}
		state.pholes = state.pholes.concat(addarr);
		state.oholes = state.oholes.concat(addarr);
	}
	setBoardState(state);
}

function nStonesChanged(event){
	v = parseInt(event.target.value);
	if (!(v >= 0)){
		v = 0;
	}
	event.target.value = v;
	$(".hole").val(v);
}
