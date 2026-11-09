// QAZAQQUIZ — FULL GAME SYSTEM
// QR CODE FIXED VERSION

const $ = id => document.getElementById(id);

let currentQuiz = null;
let draftQuestions = [];
let currentQuestion = 0;
let score = 0;
let correctAnswers = 0;
let timeLeft = 20;
let timer = null;
let answered = false;
let playerName = "Ойыншы";
let history = [];
let resultSaved = false;
let currentShareLink = "";

// SCREEN NAVIGATION

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    $(id).classList.add("active");
    window.scrollTo(0, 0);
}

function goHome() {
    clearInterval(timer);
    showScreen("home");
}

$("homeBtn").onclick = goHome;
$("headerHome").onclick = goHome;
$("goHome").onclick = goHome;
$("leaderboardHome").onclick = goHome;

// HTML SECURITY

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// CREATE QUIZ

$("createBtn").onclick = function() {
    draftQuestions = [];
    $("quizTitle").value = "";
    $("questions").innerHTML = "";

    addQuestion();
    showScreen("builder");
};

function addQuestion() {
    draftQuestions.push({
        text: "",
        options: ["", "", "", ""],
        correct: 0
    });

    renderQuestions();
}

// QUESTION EDITOR

function renderQuestions() {
    const container = $("questions");
    container.innerHTML = "";

    draftQuestions.forEach((q, i) => {
        const box = document.createElement("div");
        box.className = "question-editor";

        box.innerHTML = `
            <button class="remove-btn" type="button">Өшіру ×</button>

            <h3>${i + 1}-сұрақ</h3>

            <label>Сұрақ мәтіні</label>

            <input
                class="q-text"
                placeholder="Сұрақты енгіз..."
                value="${escapeHTML(q.text)}"
            >

            <label>Жауап нұсқалары</label>

            <div class="option-inputs">
                ${q.options.map((option, j) => `
                    <input
                        class="option-text"
                        placeholder="${String.fromCharCode(65+j)} жауабы"
                        value="${escapeHTML(option)}"
                    >
                `).join("")}
            </div>

            <label>Дұрыс жауап</label>

            <select class="correct-select">
                ${q.options.map((_, j) => `
                    <option
                        value="${j}"
                        ${q.correct === j ? "selected" : ""}
                    >
                        ${String.fromCharCode(65+j)} жауабы
                    </option>
                `).join("")}
            </select>
        `;

        container.appendChild(box);

        box.querySelector(".q-text").oninput = e => {
            draftQuestions[i].text = e.target.value;
        };

        box.querySelectorAll(".option-text").forEach((input, j) => {
            input.oninput = e => {
                draftQuestions[i].options[j] = e.target.value;
            };
        });

        box.querySelector(".correct-select").onchange = e => {
            draftQuestions[i].correct = Number(e.target.value);
        };

        box.querySelector(".remove-btn").onclick = () => {
            draftQuestions.splice(i, 1);
            renderQuestions();
        };
    });
}

$("addQuestion").onclick = addQuestion;

// SAVE QUIZ

$("saveQuiz").onclick = function() {
    const title = $("quizTitle").value.trim();

    if (!title) {
        alert("Викторина атауын енгіз!");
        return;
    }

    if (draftQuestions.length === 0) {
        alert("Кемінде бір сұрақ қос!");
        return;
    }

    for (let i = 0; i < draftQuestions.length; i++) {
        const q = draftQuestions[i];

        if (!q.text.trim()) {
            alert(`${i + 1}-сұрақтың мәтінін енгіз!`);
            return;
        }

        if (q.options.some(option => !option.trim())) {
            alert(`${i + 1}-сұрақтың жауаптарын толықтыр!`);
            return;
        }
    }

    currentQuiz = {
        title: title,
        time: Number($("timeLimit").value) || 20,
        questions: JSON.parse(JSON.stringify(draftQuestions))
    };

    localStorage.setItem("qazaqquiz", JSON.stringify(currentQuiz));

    showReady();
};

// QR CODE SYSTEM

async function encodeQuiz(quiz) {
    const bytes = new TextEncoder().encode(JSON.stringify(quiz));

    if (typeof CompressionStream !== "undefined") {
        const stream = new Blob([bytes]).stream()
            .pipeThrough(new CompressionStream("gzip"));

        const zipped = new Uint8Array(
            await new Response(stream).arrayBuffer()
        );

        let binary = "";

        zipped.forEach(b => {
            binary += String.fromCharCode(b);
        });

        return "gz." + btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
    }

    let binary = "";

    bytes.forEach(b => {
        binary += String.fromCharCode(b);
    });

    return "raw." + btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
    let b64 = value.replace(/-/g, "+").replace(/_/g, "/");

    while (b64.length % 4) {
        b64 += "=";
    }

    const binary = atob(b64);

    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function decodeQuiz(encoded) {
    const dot = encoded.indexOf(".");

    if (dot < 0) {
        throw Error("Сілтеме форматы қате");
    }

    const mode = encoded.slice(0, dot);
    const bytes = base64UrlToBytes(encoded.slice(dot + 1));

    let result = bytes;

    if (mode === "gz") {
        if (typeof DecompressionStream === "undefined") {
            throw Error("Браузер gzip ашуды қолдамайды");
        }

        const stream = new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream("gzip"));

        result = new Uint8Array(
            await new Response(stream).arrayBuffer()
        );
    } else if (mode !== "raw") {
        throw Error("Дерек форматы белгісіз");
    }

    return JSON.parse(new TextDecoder().decode(result));
}

async function makeShareLink() {
    if (!currentQuiz) return "";

    const base = location.href.split("?")[0].split("#")[0];

    return base + "?quiz=" +
        encodeURIComponent(await encodeQuiz(currentQuiz));
}

async function generateQR() {
    const box = $("qrcode");
    const message = $("qrMessage");
    const copy = $("copyLink");

    box.innerHTML = "";
    currentShareLink = "";
    copy.disabled = true;

    message.textContent = "QR-код жасалуда...";

    try {
        if (typeof QRCode === "undefined") {
            throw Error("QR кітапханасы жүктелмеді. Интернетті тексеріп, F5 бас.");
        }

        currentShareLink = await makeShareLink();

        if (!currentShareLink) {
            throw Error("Сілтеме жасалмады.");
        }

        new QRCode(box, {
            text: currentShareLink,
            width: 220,
            height: 220,
            colorDark: "#252044",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        copy.disabled = false;

        message.textContent = "QR-код дайын! 📱 Телефонмен сканерле.";

    } catch (error) {
        box.innerHTML = "<p>QR-кодты жасау мүмкін болмады.</p>";
        message.textContent = error.message;

        console.error(error);
    }
}

$("copyLink").onclick = async function() {
    if (!currentShareLink) return;

    try {
        await navigator.clipboard.writeText(currentShareLink);

        $("qrMessage").textContent = "Сілтеме көшірілді! ✓";

    } catch {
        $("qrMessage").textContent =
            "Сілтемені көшіру үшін браузер рұқсатын тексер.";
    }
};

// READY SCREEN

function showReady() {
    $("readyTitle").textContent = currentQuiz.title;

    $("readyInfo").textContent =
        `${currentQuiz.questions.length} сұрақ · ${currentQuiz.time} секунд`;

    $("playerName").value = "";

    showScreen("ready");

    generateQR();
}

// PLAY SAVED QUIZ

$("playBtn").onclick = function() {
    const saved = localStorage.getItem("qazaqquiz");

    if (!saved) {
        alert("Алдымен викторина құрастыр!");
        return;
    }

    try {
        currentQuiz = JSON.parse(saved);
        showReady();
    } catch {
        alert("Сақталған викторина ашылмады.");
    }
};

// AUTOMATION AND CONTROL QUIZ

$("exampleBtn").onclick = function() {
    currentQuiz = {
        title: "Автоматтандыру және басқару",
        time: 20,

        questions: [
            {
                text: "Автоматтандыру дегеніміз не?",
                options: [
                    "Процестерді автоматты түрде басқару",
                    "Тек қолмен жұмыс істеу",
                    "Құрылғыларды бояу",
                    "Ғимарат салу"
                ],
                correct: 0
            },
            {
                text: "PLC дегеніміз не?",
                options: [
                    "Температура өлшегіш",
                    "Бағдарламаланатын логикалық контроллер",
                    "Электр қозғалтқышы",
                    "Қысым өлшегіш"
                ],
                correct: 1
            },
            {
                text: "Датчиктің негізгі қызметі қандай?",
                options: [
                    "Электр энергиясын сақтау",
                    "Құрылғыны өшіру",
                    "Физикалық шаманы өлшеп, сигнал беру",
                    "Бағдарлама жазу"
                ],
                correct: 2
            },
            {
                text: "Температураны өлшейтін құрал қалай аталады?",
                options: [
                    "Манометр",
                    "Амперметр",
                    "Вольтметр",
                    "Термометр"
                ],
                correct: 3
            },
            {
                text: "Қысымды өлшейтін құралды көрсетіңіз.",
                options: [
                    "Манометр",
                    "Термометр",
                    "Вольтметр",
                    "Омметр"
                ],
                correct: 0
            },
            {
                text: "Электр тогының өлшем бірлігі қандай?",
                options: [
                    "Вольт",
                    "Ампер",
                    "Ом",
                    "Ватт"
                ],
                correct: 1
            },
            {
                text: "Кернеуді өлшейтін құрал қалай аталады?",
                options: [
                    "Амперметр",
                    "Манометр",
                    "Вольтметр",
                    "Термометр"
                ],
                correct: 2
            },
            {
                text: "Автоматтандыру жүйесінің негізгі мақсаты қандай?",
                options: [
                    "Жұмысты қиындату",
                    "Құрылғылар санын көбейту",
                    "Электр қуатын өшіру",
                    "Өндіріс процесін тиімді басқару"
                ],
                correct: 3
            },
            {
                text: "Контроллер не үшін қолданылады?",
                options: [
                    "Жүйені автоматты басқару үшін",
                    "Ғимаратты бояу үшін",
                    "Қағаз басып шығару үшін",
                    "Музыка тыңдау үшін"
                ],
                correct: 0
            },
            {
                text: "Атқарушы механизмнің қызметі қандай?",
                options: [
                    "Ақпаратты сақтау",
                    "Басқару командасын физикалық әрекетке айналдыру",
                    "Температураны көрсету",
                    "Деректерді басып шығару"
                ],
                correct: 1
            },
            {
                text: "Манометр қандай шаманы өлшейді?",
                options: [
                    "Жылдамдықты",
                    "Температураны",
                    "Қысымды",
                    "Жарықты"
                ],
                correct: 2
            },
            {
                text: "Өндірісте автоматтандыру не үшін қажет?",
                options: [
                    "Қателерді көбейту үшін",
                    "Жұмыс уақытын ұзарту үшін",
                    "Құрылғыларды тоқтату үшін",
                    "Өнім сапасы мен қауіпсіздігін арттыру үшін"
                ],
                correct: 3
            },
            {
                text: "Реле дегеніміз не?",
                options: [
                    "Электр тізбегін автоматты қосып-ажырататын құрылғы",
                    "Температура өлшейтін құрал",
                    "Қысым датчигі",
                    "Бағдарламалау тілі"
                ],
                correct: 0
            },
            {
                text: "Электр кедергісінің өлшем бірлігі қандай?",
                options: [
                    "Ампер",
                    "Ом",
                    "Вольт",
                    "Герц"
                ],
                correct: 1
            },
            {
                text: "SCADA жүйесі не үшін қолданылады?",
                options: [
                    "Музыка тыңдау үшін",
                    "Фото өңдеу үшін",
                    "Өндірістік процестерді бақылау және басқару үшін",
                    "Мәтін теру үшін"
                ],
                correct: 2
            },
            {
                text: "Температура датчигі нені анықтайды?",
                options: [
                    "Қысымды",
                    "Жылдамдықты",
                    "Электр қуатын",
                    "Температураны"
                ],
                correct: 3
            },
            {
                text: "Кері байланыс жүйесі не үшін қажет?",
                options: [
                    "Жүйе нәтижесін өлшеп, басқаруды түзету үшін",
                    "Жүйені толығымен өшіру үшін",
                    "Электр қуатын сақтау үшін",
                    "Құрылғыны бояу үшін"
                ],
                correct: 0
            },
            {
                text: "Амперметр тізбекке қалай жалғанады?",
                options: [
                    "Параллель",
                    "Тізбектей",
                    "Жерге ғана",
                    "Жалғанбайды"
                ],
                correct: 1
            },
            {
                text: "Өлшеу дәлдігі нені сипаттайды?",
                options: [
                    "Құралдың сыртқы түрін",
                    "Құралдың салмағын",
                    "Өлшеу нәтижесінің нақты мәнге жақындығын",
                    "Құралдың түсін"
                ],
                correct: 2
            },
            {
                text: "Мұнай-газ өндірісінде автоматтандыру не үшін маңызды?",
                options: [
                    "Тек жарықты қосу үшін",
                    "Құралдарды әдемі көрсету үшін",
                    "Қағаз үнемдеу үшін",
                    "Қысым, температура және процестерді қауіпсіз бақылау үшін"
                ],
                correct: 3
            }
        ]
    };

    showReady();
};

// START GAME

$("startGame").onclick = function() {
    if (!currentQuiz || !currentQuiz.questions.length) {
        alert("Алдымен викторина таңда!");
        return;
    }

    playerName = $("playerName").value.trim() || "Ойыншы";

    currentQuestion = 0;
    score = 0;
    correctAnswers = 0;
    history = [];
    resultSaved = false;

    showScreen("game");
    loadQuestion();
};

// LOAD QUESTION

function loadQuestion() {
    clearInterval(timer);

    answered = false;

    const q = currentQuiz.questions[currentQuestion];

    timeLeft = currentQuiz.time;

    $("gameTitle").textContent = currentQuiz.title;
    $("score").textContent = score;

    $("questionCount").textContent =
        `${currentQuestion + 1} / ${currentQuiz.questions.length}`;

    $("questionNumber").textContent =
        `СҰРАҚ ${currentQuestion + 1}`;

    $("questionText").textContent = q.text;

    $("feedback").textContent = "";
    $("nextQuestion").hidden = true;

    $("nextQuestion").textContent =
        currentQuestion === currentQuiz.questions.length - 1
            ? "Нәтижені көру →"
            : "Келесі сұрақ →";

    const answers = $("answers");
    answers.innerHTML = "";

    q.options.forEach((option, i) => {
        const button = document.createElement("button");

        button.className = "answer-btn";
        button.textContent =
            `${String.fromCharCode(65+i)}. ${option}`;

        button.onclick = () => chooseAnswer(i);

        answers.appendChild(button);
    });

    updateTimer();

    timer = setInterval(() => {
        timeLeft--;
        updateTimer();

        if (timeLeft <= 0) {
            timeOut();
        }
    }, 1000);
}

// TIMER

function updateTimer() {
    $("timer").textContent = timeLeft;

    $("timerBar").style.width =
        (timeLeft / currentQuiz.time * 100) + "%";

    $("timerBar").classList.toggle(
        "urgent",
        timeLeft <= 5
    );
}

// CHECK ANSWER

function chooseAnswer(index) {
    if (answered) return;

    answered = true;
    clearInterval(timer);

    const q = currentQuiz.questions[currentQuestion];
    const correct = index === q.correct;

    let points = 0;

    if (correct) {
        correctAnswers++;

        points = Math.max(
            100,
            Math.round(1000 * timeLeft / currentQuiz.time)
        );

        score += points;
    }

    history.push({
        question: q.text,
        chosen: q.options[index],
        correctAnswer: q.options[q.correct],
        correct: correct
    });

    [...$("answers").children].forEach((button, i) => {
        button.disabled = true;

        if (i === q.correct) {
            button.classList.add("correct");
        }

        if (i === index && !correct) {
            button.classList.add("wrong");
        }
    });

    $("feedback").textContent = correct
        ? `Дұрыс жауап! +${points} ұпай ⭐`
        : `Қате! Дұрыс жауап: ${q.options[q.correct]}`;

    $("feedback").style.color = correct ? "#20b889" : "#ed5273";

    $("score").textContent = score;
    $("nextQuestion").hidden = false;
}

// TIME OUT

function timeOut() {
    if (answered) return;

    answered = true;
    clearInterval(timer);

    const q = currentQuiz.questions[currentQuestion];

    history.push({
        question: q.text,
        chosen: "Уақыт аяқталды",
        correctAnswer: q.options[q.correct],
        correct: false
    });

    [...$("answers").children].forEach((button, i) => {
        button.disabled = true;

        if (i === q.correct) {
            button.classList.add("correct");
        }
    });

    $("feedback").textContent =
        `Уақыт аяқталды! Дұрыс жауап: ${q.options[q.correct]}`;

    $("feedback").style.color = "#ed5273";

    $("nextQuestion").hidden = false;
}

// NEXT QUESTION

$("nextQuestion").onclick = function() {
    if (currentQuestion < currentQuiz.questions.length - 1) {
        currentQuestion++;
        loadQuestion();
    } else {
        showResult();
    }
};

// LEADERBOARD

function getLeaderboard() {
    try {
        return JSON.parse(
            localStorage.getItem("qazaqLeaderboard") || "[]"
        );
    } catch {
        return [];
    }
}

function saveLeaderboard() {
    if (resultSaved) return;

    resultSaved = true;

    const list = getLeaderboard();

    list.push({
        name: playerName,
        score: score,
        correct: correctAnswers,
        total: currentQuiz.questions.length,
        quiz: currentQuiz.title,
        date: new Date().toLocaleDateString("kk-KZ")
    });

    list.sort((a, b) => b.score - a.score);

    localStorage.setItem(
        "qazaqLeaderboard",
        JSON.stringify(list.slice(0, 50))
    );
}

function showLeaderboard() {
    const list = getLeaderboard();
    const container = $("leaderboardList");

    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = `
            <div class="leaderboard-empty">
                Әзірге ойын нәтижелері жоқ.
                <br><br>
                Бірінші болып ойынды баста!
            </div>
        `;
    }

    list.forEach((player, i) => {
        const item = document.createElement("div");
        item.className = "leaderboard-item";

        const medal =
            i === 0 ? "🥇" :
            i === 1 ? "🥈" :
            i === 2 ? "🥉" :
            `${i + 1}.`;

        item.innerHTML = `
            <div>
                <span class="rank">${medal}</span>
                ${escapeHTML(player.name)}
            </div>

            <div class="player-points">
                ${Number(player.score) || 0} ⭐
            </div>
        `;

        container.appendChild(item);
    });

    showScreen("leaderboard");
}

$("leaderboardBtn").onclick = showLeaderboard;

// RESULT

function showResult() {
    clearInterval(timer);
    saveLeaderboard();

    showScreen("result");

    const total = currentQuiz.questions.length;

    const percent = Math.round(
        correctAnswers / total * 100
    );

    $("resultTitle").textContent =
        percent >= 80
            ? "Керемет нәтиже! 🏆"
            : percent >= 50
                ? "Жақсы жұмыс! 🥇"
                : "Тағы да байқап көр! 💪";

    $("finalScore").textContent = score + " ұпай";

    $("resultDescription").textContent =
        `${playerName}, сен ${total} сұрақтың ${correctAnswers}-іне дұрыс жауап бердің. Дәлдігің: ${percent}%.`;

    $("review").innerHTML =
        "<h3>Жауаптарды тексеру</h3>";

    history.forEach((item, i) => {
        const div = document.createElement("div");
        div.className = "review-item";

        div.innerHTML = `
            <b>${i + 1}. ${escapeHTML(item.question)}</b>

            <p class="${item.correct ? "correct-text" : "wrong-text"}">
                ${item.correct ? "✓ Дұрыс" : "✕ Қате"}
                — Сенің жауабың: ${escapeHTML(item.chosen)}
            </p>

            ${!item.correct
                ? `<p>Дұрыс жауап: ${escapeHTML(item.correctAnswer)}</p>`
                : ""}
        `;

        $("review").appendChild(div);
    });
}

// RESTART

$("restart").onclick = showReady;

// LOAD SHARED QUIZ FROM QR LINK

async function loadSharedQuiz() {
    const encoded = new URLSearchParams(location.search).get("quiz");

    if (!encoded) return;

    try {
        const quiz = await decodeQuiz(encoded);

        const valid =
            quiz &&
            typeof quiz.title === "string" &&
            Array.isArray(quiz.questions) &&
            quiz.questions.length > 0 &&
            quiz.questions.every(q =>
                q &&
                typeof q.text === "string" &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                Number.isInteger(q.correct) &&
                q.correct >= 0 &&
                q.correct < 4 &&
                q.options.every(option => typeof option === "string")
            );

        if (!valid) {
            throw Error("Викторина құрылымы қате");
        }

        quiz.time = Math.max(
            5,
            Math.min(120, Number(quiz.time) || 20)
        );

        currentQuiz = quiz;

        showReady();

    } catch (error) {
        console.error(error);
        alert("Викторина сілтемесі дұрыс емес немесе толық емес!");
    }
}

loadSharedQuiz();