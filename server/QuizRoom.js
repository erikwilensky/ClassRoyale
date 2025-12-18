import { Room, Schema, MapSchema } from "colyseus";

class QuizState extends Schema {
    questionText = "";
    timeRemaining = 0;
    answers = new MapSchema();
    roundActive = false;
}

export class QuizRoom extends Room {
    timerInterval = null;

    onCreate(options) {
        this.setState(new QuizState());
        this.maxClients = 50;

        this.onMessage("startRound", (client, message) => {
            if (!client.metadata || client.metadata.role !== "teacher") {
                return;
            }

            this.state.questionText = message.question;
            this.state.timeRemaining = message.duration;
            this.state.roundActive = true;
            this.state.answers.clear();

            this.broadcast("ROUND_STARTED", {
                question: message.question,
                duration: message.duration
            });

            this.startTimer();
            this.checkAndEndRound();
        });

        this.onMessage("submitAnswer", (client, message) => {
            if (!client.metadata || client.metadata.role !== "student") {
                return;
            }

            if (!this.state.roundActive) {
                return;
            }

            this.state.answers.set(client.sessionId, message.answer);
            this.checkAndEndRound();
        });
    }

    onJoin(client, options) {
        const role = options.role || "student";
        client.metadata = { role };

        if (this.state.roundActive) {
            client.send("ROUND_STARTED", {
                question: this.state.questionText,
                duration: this.state.timeRemaining
            });
        }
    }

    onLeave(client, abandonned) {
        this.state.answers.delete(client.sessionId);
        if (this.clients.length === 0 && this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    onDispose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            if (!this.state.roundActive) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                return;
            }

            this.state.timeRemaining = Math.max(0, this.state.timeRemaining - 1);

            this.broadcast("TIMER_UPDATE", {
                timeRemaining: this.state.timeRemaining
            });

            if (this.state.timeRemaining <= 0) {
                this.endRound();
            }
        }, 1000);
    }

    checkAndEndRound() {
        if (!this.state.roundActive) {
            return;
        }

        const studentClients = this.clients.filter(c => c.metadata.role === "student");
        const allStudentsAnswered = studentClients.length > 0 && 
            studentClients.every(client => this.state.answers.has(client.sessionId));

        if (allStudentsAnswered) {
            this.endRound();
        }
    }

    endRound() {
        if (!this.state.roundActive) {
            return;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.state.roundActive = false;

        const answersArray = Array.from(this.state.answers.entries()).map(([clientId, answer]) => ({
            clientId,
            text: answer
        }));

        this.broadcast("ROUND_ENDED", {
            answers: answersArray
        });

        console.log("Round ended. Answers collected:");
        this.state.answers.forEach((answer, clientId) => {
            console.log(`  ${clientId}: ${answer}`);
        });
    }
}

