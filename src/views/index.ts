let Terminal = {
	usr: "user@magnuscardell",
	dir: "~/",
	text: '',
	index: 0,
	speed: 3,
	working: false,
	file: "src/script.txt",
	input: "",
	input_p: 0,
	history: [] as string[],
	history_p: 0,
	init () {
		// setInterval(function () { Terminal.print_cursor(); }, 500);
		$.get(Terminal.file, data => {
			Terminal.text = data.substring(0, data.length - 1);
		});
		$(document).on("keydown", e => {
			if (!Terminal.working && e.which >= 32 && e.which <= 126) {
				const c = String.fromCharCode(e.which).toLowerCase();
				Terminal.appendBuffer(c);
				e.preventDefault();
			}
			else if (e.keyCode === 8) { // backspace
				Terminal.deleteBuffer(e.shiftKey, 0);
				e.preventDefault();
			}
			else if (e.keyCode === 46) { // del
				Terminal.deleteBuffer(e.shiftKey, 1);
				e.preventDefault();
			}
			else if (e.keyCode === 13) { // return
				Terminal.processBuffer();
				e.preventDefault();
			}
			else if (e.keyCode === 37) { // left
				// Terminal.bufferShift(-1);
				e.preventDefault();
			}
			else if (e.keyCode === 39) { // right
				// Terminal.bufferRight(1);
				e.preventDefault();
			}
			else if (e.keyCode === 38) { // up
				// Terminal.shiftHistory(-1);
				e.preventDefault();
			}
			else if (e.keyCode === 40) { // down
				// Terminal.shiftHistory(1);
				e.preventDefault();
			}
		});
	},

	appendBuffer (c: string) {
		const lh = Terminal.input.substr(0, Terminal.input_p);
		const rh = Terminal.input.substr(Terminal.input_p, Terminal.input.length - Terminal.input_p);
		Terminal.input = lh + c + rh;
		Terminal.input_p++;
		Terminal.updateInputfield();
	},
	deleteBuffer (completely: boolean, pos: number) {
		const offset = completely ? 1 : 0;
		if (this.input_p >= (1 - offset + pos)) {
			const lh = this.input.substr(0, this.input_p - 1 + offset + pos);
			const rh = this.input.substr(this.input_p + offset + pos, this.input.length - pos - offset + pos);
			this.input = lh + rh;
			this.input_p -= 1 - offset + pos;
			this.updateInputfield();
		}
	},
	processBuffer () {
		if (!(Terminal.input.length > 0)) {
			return;
		}
		Terminal.printOneliner(Terminal.input);
		Terminal.history.push(Terminal.input);
		Terminal.history_p++;
		Terminal.input = '';
		Terminal.input_p = 0;
		Terminal.updateInputfield();
		Terminal.process(Terminal.input);
	},
	printOneliner (str: string) {
		const c = "<div class='onelin'><span class='prompt user'>" + Terminal.usr + "</span><!--" +
			"--><span class='prompt directory'>" + Terminal.dir + "</span><!--" +
			"--><span class='prompt dollarsign'>&gt;&nbsp;</span><!--" +
			"--><span class='prompt text'>" + str + "</span><!--";
		$('#output').append(c);
	},
	process (input: string) {
		if(input === "cat about_me.txt"){
			Terminal.printScript();
		}
		$('#output').append("Command not recognized");
	},

	updateInputfield () {
		let left = '';
		let pointer = ' ';
		let right = '';
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

		$('#lh').html(left);
		$('#pointer').html(pointer);
		if (pointer === ' ') {
			$('#cursor').html('&nbsp;');
		}
		$('#rh').text(right);
		$('#usr').text(Terminal.usr);
		$('#dir').text(Terminal.dir);
		return;
	},
	content () {
		return $("#output").html();
	},
	setWorking (b: boolean) {
		this.working = b;
	},

	printScript () {
		if (Terminal.text) {
			Terminal.index += Terminal.speed;
			const text = Terminal.text.substring(0, Terminal.index)
			const rtn = new RegExp("\n", "g");

			$("#output").html(text.replace(rtn, "<br/>"));
		}
	},
	print_cursor () {
		const cont = this.content();
		if (cont.substring(cont.length - 1, cont.length) === "|")
			$("#output").html($("#output").html().substring(0, cont.length - 1));
		else
			$("#output").append("|");
	}
}

Terminal.init();
Terminal.setWorking(true);
let timer = setInterval("t();", 2);
function t() {
	Terminal.printScript();
	if (Terminal.index > Terminal.text.length) {
		clearInterval(timer);
		Terminal.appendBuffer('');
		Terminal.setWorking(false);
	}
}