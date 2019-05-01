var Terminal = {
	usr: "user@magnuscardell",
	dir: "~/",
	text: '',
	index: 0,
	speed: 5,
	working: false,
	file: "src/script.txt",
	input: "",
	input_p: 0,
	history: [],
	history_p: 0,
	init: function () {
		// setInterval(function () { Terminal.print_cursor(); }, 500);
		$.get(Terminal.file, function (data) {
			Terminal.text = data.substring(0, data.length - 1);
		});
		//special keyboard listeners
		$(document).keydown(function (e) {
			if ( !Terminal.working && e.which >= 32 && e.which <= 126) {
				var c = String.fromCharCode(e.which).toLowerCase();
				Terminal.appendBuffer(c);
				e.preventDefault();
			}
			else if(e.keyCode == 8){ //backspace
				Terminal.deleteBuffer(e.shiftKey, 0);
				e.preventDefault();
			}
			else if(e.keyCode == 46){ //del
				Terminal.deleteBuffer(e.shiftKey, 1);
				e.preventDefault();
			}
			else if(e.keyCode == 13){ //return
				Terminal.processBuffer();
				e.preventDefault();
			}
			else if(e.keyCode == 37){ //left
				console.log("left");
				Terminal.bufferShift(-1);
				e.preventDefault();
			}
			else if(e.code == 39){ //right
				console.log("right");
				Terminal.bufferRight(1);
				e.preventDefault();
			}
			else if(e.keyCode == 38){ //up
				console.log("up");
				Terminal.shiftHistory(-1);
				e.preventDefault();
			}
			else if(e.keyCode == 40){ //down
				console.log("down");
				Terminal.shiftHistory(1);
				e.preventDefault();
			}
			
		})
	},

	appendBuffer: function(c){
		var lh = Terminal.input.substr(0, Terminal.input_p);
		var rh = Terminal.input.substr(Terminal.input_p, Terminal.input.length-Terminal.input_p);
		Terminal.input = lh + c + rh;
		Terminal.input_p++;
		Terminal.updateInputfield();
	},
	deleteBuffer: function(completely, pos) {
		var offset = completely ? 1 : 0;
		if (this.input_p >= (1 - offset+ pos)) {
			var lh = this.input.substr(0, this.input_p - 1 + offset + pos);
			var rh = this.input.substr(this.input_p + offset + pos, this.input.length - this.pos - offset + pos);
			this.input = lh + rh;
			this.input_p -= 1 - offset + pos;
			this.updateInputfield();
		}
	},
	processBuffer: function() {
		if(!Terminal.input.length > 0){
			return;
		}
		Terminal.printOneliner(Terminal.input);
		Terminal.history.push(Terminal.input);
		Terminal.history_p++;
		Terminal.input = '';
		Terminal.input_p = 0;
		Terminal.updateInputfield();
		Terminal.process();
	},
	printOneliner: function(str){
		var c ="<div class='onelin'><span class='prompt user'>" + Terminal.usr + "</span><!--" +
							 "--><span class='prompt directory'>" + Terminal.dir + "</span><!--" +
							 "--><span class='prompt dollarsign'>&gt;&nbsp;</span><!--" +
							 "--><span class='prompt text'>" + str + "</span><!--";
		$('#output').append(c);
	},
	process: function() {
		$('#output').append("Command not recognized");
	},

	updateInputfield: function() {
		var left = '', pointer = ' ', right = '';
		if (this.input_p < 0) {
			this.input_p = 0;
		}
		if (this.input_p > this.input.length) {
			this.input_p = this.input.length;
		}
		if (this.input_p > 0) {
			left = this.input.substr(0, this.input_p);
		}
		if (this.input_p < this.input.length) {
			pointer = this.input.substr(this.input_p, 1);
		}
		if (this.input.length - this.input_p > 1) {
			right = this.input.substr(this.input_p + 1, this.input.length - this.input_p - 1);
		}

		//console.log(left + " " + pointer + " " + right);
		$('#lh').html(left);
		$('#pointer').html(pointer);
		if (pointer == ' ') {
			$('#cursor').html('&nbsp;');
		}
		$('#rh').text(right);
		$('#usr').text(Terminal.usr);
		$('#dir').text(Terminal.dir);
		return;
	},
	content: function () {
		return $("#output").html();
	},
	setWorking : function(b){
		this.working = b;
	},

	printScript: function () {
		if (Terminal.text) {
			Terminal.index += Terminal.speed;
			var text = Terminal.text.substring(0, Terminal.index)
			var rtn = new RegExp("\n", "g");

			$("#output").html(text.replace(rtn, "<br/>"));
			window.scrollBy(0, 50);
		}
	},
	print_cursor: function () {
		var cont = this.content();
		if (cont.substring(cont.length - 1, cont.length) == "|")
			$("#output").html($("#output").html().substring(0, cont.length - 1));
		else
			$("#output").append("|");
	}
}

Terminal.init();
Terminal.setWorking(true);
var timer = setInterval("t();", 20);
function t() {
	Terminal.printScript();
	if (Terminal.index > Terminal.text.length) {
		clearInterval(timer);
		Terminal.appendBuffer('');
		Terminal.setWorking(false);
	}
}