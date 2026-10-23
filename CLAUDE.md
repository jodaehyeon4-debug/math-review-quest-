# 수학 복습 퀘스트 · Claude Code 작업 규칙

2학년 연산 복습 도트 웹게임(학생, 태블릿)과 교사 기록장(PC). 빌드 없는 정적 앱입니다. 자세한 구조는 docs/HANDOFF.md.

## 명령
- 실행: `npm start` (http://localhost:5173)
- 테스트: `npm test` — 생성기 검사, 가상 브라우저 스모크 테스트 2회(기기 저장 / 저장소 모의). 무엇을 고치든 끝나면 반드시 실행.

## 구조
- `js/app.js` 한 파일, 즉시 실행 함수 하나. 구역은 `/* ===== 이름 ===== */` 주석. 전역으로 내보내는 것은 없음.
- 저장은 `record()` → `touch()` → `flush()`만 거침. 학생 문서는 `students/sNN`, 설정은 `config/class`.
- 저장소는 `window.MRQ_DB`(Firestore compat 모양) → 없으면 claude.ai `db` → 없으면 localStorage.
- 게임 객체는 `start(u)`, `update(dt)`, `draw()`, `tap(x,y)`, `onKey(e,k)`. 새 게임은 `GAMES`, `UGAMES`, `launch()`의 표에 등록.

## 지켜야 할 것
- 문제는 항상 알고리즘으로 생성. 고정 문제 목록을 만들지 않음. 최근 문제 중복 방지(`nextProblem`)와 틀린 유형 재출제(`retryLater`)를 우회하지 않음.
- 모든 풀이는 `record(u, p, given, ok, ms, mode)`로 기록. mode는 직접 쓰기 'k', 고르기 'c'.
- 학생 문구: 2학년 눈높이, 짧은 문장, 존댓말 안내 + 반말 호명("지우야, …해볼래?"). 호명은 `callName()`.
- 연산 기호는 글꼴 대신 `opHTML()` 도형을 씀 (글꼴의 − 기호가 작게 나오는 문제 때문).
- 학생 화면은 태블릿 터치 기준(버튼 최소 72px). 교사 화면은 PC 1280px 이상 기준, `body.paper` 스타일.
- 교사 화면에는 학생 간 순위를 만들지 않음 (학급 목표는 협동형).
- 평가 문장(`evalText`)은 기록된 숫자로만 만듦. 성격·태도 추측 문장 금지.
- 색은 `css/style.css` 맨 위 `:root` 토큰을 씀.
