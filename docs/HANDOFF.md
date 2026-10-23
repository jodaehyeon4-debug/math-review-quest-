# 수학 복습 퀘스트 · 인계 문서

2학년 덧셈·뺄셈·곱셈 복습용 도트 웹게임과 교사 기록장입니다. 빌드 과정이 없는 정적 웹앱이라 파일을 그대로 올리면 동작합니다.

- 학생: 태블릿에서 번호를 고른 뒤 단원마다 STEP 1(4문제) → STEP 2(6문제) → STEP 3(게임 고르기) 순서로 진행합니다.
- 교사: PC에서 '선생님 기록장'을 열어 학급 현황, 학생별 기록, 곱셈구구 지도, 설정을 봅니다. 초기 비밀번호는 2106입니다.
- 학급: 기본 8명, 이름 없이 번호만 보입니다. 학생 수와 이름은 교사 기록장 설정 탭에서 넣습니다. 이름은 공개 저장소에 올리지 않도록 코드에 두지 않습니다.

## 1. 바로 실행하기

```bash
npm install        # 테스트용 jsdom만 설치됩니다. 앱 실행에는 필요 없습니다.
npm start          # http://localhost:5173
npm test           # 생성기 검사 + 스모크 테스트(기기 저장) + 스모크 테스트(저장소 연결 모의)
```

`index.html`을 파일로 직접 열어도 동작합니다. 다만 그때는 저장 위치가 브라우저마다 따로라서, 실제 수업에서는 아래 2절대로 배포하세요.

## 2. 배포

### 2-1. GitHub Pages (지금 쓰는 방식)
저장소의 `main` 브랜치 맨 위 폴더를 GitHub Pages로 그대로 띄웁니다. 빌드 과정은 없습니다. `main`에 올리면 1~2분 뒤 사이트에 반영됩니다.
`js/storage-config.js`의 `MRQ_FIREBASE`가 `null`이면 각 태블릿 기록이 그 태블릿에만 남고, 교사 기록장은 교사 PC에 남은 기록만 봅니다.

### 2-2. 기록을 교사 PC로 모으기 (Firebase)
1. https://console.firebase.google.com 에서 프로젝트를 만들고 Firestore Database와 Authentication(익명 로그인)을 켭니다.
2. Authentication > 설정 > 승인된 도메인에 GitHub Pages 주소(`아이디.github.io`)를 넣습니다.
3. 프로젝트 설정 > 내 앱 > 웹 앱을 하나 만들고, 나온 `firebaseConfig`의 `apiKey`, `authDomain`, `projectId`, `appId`를 `js/storage-config.js`의 `MRQ_FIREBASE`에 적습니다. (이 값들은 공개되어도 되는 값이고, 실제 보호는 보안 규칙이 합니다.)
4. 교사 PC에서 사이트를 열고 선생님 기록장 > 설정 탭 아래에 보이는 'Firebase UID'를 복사해 `firestore.rules`의 `TEACHER_UID` 자리에 넣고, Firestore > 규칙에 붙여 넣어 게시합니다.
5. 태블릿과 교사 PC가 같은 주소를 열면 기록이 실시간으로 모입니다.

교사 UID는 그 PC 브라우저의 익명 로그인 값이라, 브라우저 데이터를 지우거나 다른 PC를 쓰면 바뀝니다. 그때는 4번을 다시 하면 됩니다.

다른 저장소(Supabase, 학교 서버 등)를 쓰려면 `window.MRQ_DB`에 같은 모양의 객체만 만들어 넣으면 됩니다. 필요한 함수는 `js/storage-config.js` 주석에 정리했습니다.

claude.ai 아티팩트 안에서 열면 claude.ai 저장소를 자동으로 씁니다. 그 경로는 지금도 그대로 동작합니다.

## 3. 배포 전에 꼭 정할 것

| 항목 | 현재 상태 | 권장 |
|---|---|---|
| 교사 로그인 | 비밀번호 4자리를 `config/class` 문서에 두고 화면에서 비교합니다. 개발자 도구를 열면 볼 수 있습니다. | Firebase Auth 이메일 로그인으로 바꾸고 `pw` 필드를 지우세요. 그 뒤 `firestore.rules`가 교사만 설정을 쓰게 막아 줍니다. |
| 학생 이름 | 코드에는 이름이 없습니다. 설정 탭에서 넣은 이름은 `config/class.roster`(Firebase) 또는 그 기기에만 저장됩니다. | 학교 개인정보 지침을 확인하세요. 별명이나 번호만 쓰려면 설정 탭에서 이름을 비우면 됩니다. |
| 설정 저장 | 규칙의 `TEACHER_UID`와 다른 기기에서는 설정 저장이 실패하고 '기록장 저장에 실패했어요'가 뜹니다. | 2-2절 4번대로 교사 PC의 UID를 규칙에 넣으세요. |

## 4. 파일 구조

```
index.html                 화면 뼈대 (모든 화면이 <section class="screen">으로 들어 있음)
css/style.css              전체 스타일 (학생 화면 = 도트 패널, 교사 화면 = body.paper)
js/storage-config.js       저장소 연결 지점 (MRQ_FIREBASE 설정 → window.MRQ_DB)
js/app.js                  앱 본체 하나 (즉시 실행 함수 안에 전부 들어 있음)
firestore.rules            Firestore 보안 규칙 기본안
tests/generators.js        문제 생성기 검사
tests/smoke.js             가상 브라우저 통합 테스트
```

### js/app.js 구역 지도
주석 `/* ===== 이름 ===== */`로 나뉘어 있습니다.

| 구역 | 내용 |
|---|---|
| utilities | `$`, `R`(난수), `shuffle`, `esc`, `today`, `LS`(localStorage 래퍼) |
| storage | `Store`(저장소 연결), `CFG`(학급 설정), `loadStudent`, `touch`/`flush`(1.5초 묶음 저장) |
| sound | 효과음. 읽어 주기(TTS)는 sound 바로 아래 `speak`, `sayText` |
| pixel art | 스프라이트 문자열(`SPR`), 팔레트, 3×5 숫자 글꼴 `drawTxt` |
| problem engine | 문제 생성 전부. 아래 5절 |
| recording | `record()`: 모든 풀이가 여기를 거쳐 기록됨 |
| screens | 화면 전환 `show()`, 단원 선택, 오늘의 미션, 복습 상자, 성장 기록, STEP 1·2 |
| game shell | 캔버스(192×144 논리 픽셀), 게임 루프, 오버레이, 문제창 |
| RACER ~ PAIR | 게임 7종. 각 게임은 `start(u)`, `update(dt)`, `draw()`, `tap(x,y)`, `onKey(e,k)`를 가진 객체 |
| GAME PICKER | `GAMES`(게임 목록), `UGAMES`(단원별 게임), `launch()` |
| teacher login / dashboard | 교사 기록장 전체. 아래 7절 |

## 5. 문제 생성 원칙 (바꾸지 말아야 할 부분)

- 문제는 매번 알고리즘으로 새로 만듭니다. 저장된 문제 목록은 없습니다.
- 덧셈 7단계 `a1`~`a7`, 뺄셈 6단계 `s1`~`s6`, □ 문제 `am`/`sm`, 곱셈은 곱 하나하나(`7x8`)가 기록 단위입니다.
- 최근 16문제와 같은 문제가 나오면 다시 만듭니다 (`nextProblem`).
- 틀린 문제는 2~3문제 뒤에 같은 유형의 새 숫자로 다시 나옵니다 (`retryLater`).
- 곱셈은 학생이 틀리거나 오래 걸린 곱이 더 자주 나오도록 비중을 줍니다 (`genMul`).
- 보기에는 아이들이 실제로 하는 실수(받아올림 빠뜨림, 거꾸로 빼기 등)를 넣습니다 (`distract`). 오답은 `classify`가 오류 유형으로 나눕니다.
- 생성기를 고치면 `npm test`로 꼭 확인하세요. 단계마다 3,000문제씩 만들어 조건을 검사합니다.

## 6. 데이터 구조

### students/sNN (학생 한 명 = 문서 하나)
```js
{ id:'s01', no:1, updatedAt:1729650000000,
  units:{ add:{…}, sub:{…}, mul:{…} } }
```
단원(`units.add` 등)의 필드는 다음과 같습니다.

| 필드 | 뜻 |
|---|---|
| `phase` | 0 대기, 1 STEP 1, 2 STEP 2, 3 게임 |
| `step` | 진행 중인 STEP의 문제 목록과 답 기록 (이어하기용) |
| `game` | 게임 진행 상태. 덧셈 `tier, track, prog, hearts, coins` / 뺄셈 `tier, round, prog, hearts, score` / 곱셈 `ver:2, unlocked, floor, mi, mhp, wd, hp, best` |
| `stats` | 누적 수. `kn/kc/kt` 직접 쓰기 문제 수·정답·시간(ms), `cn/cc` 고르기 문제 수·정답 |
| `skills` | 유형별 `{n, c, t, tn}` (푼 수, 맞힌 수, 쓰기 시간 합, 쓰기 횟수) |
| `errs` | 오류 유형별 횟수 (`carry`, `borrow`, `neigh` 등. 이름은 `ERRS`) |
| `recent` | 최근 30문제 `{q, ans, g, ok, t, m:'k'\|'c', e, at, k}` |
| `sessions` | 최근 12회 `{d, s1:[맞힘,문제수], s2:[…], gc, gn}` |
| `daily` | 최근 20일 `{'2026-10-23':[푼 수, 맞힌 수]}` |
| `arc` | 게임별 `{best, plays}` |
| `last` | 마지막으로 한 게임 id (`race`, `block`, `rain`, `frog`, `mole`, `dun`, `pair`) |

### config/class (학급 설정)
```js
{ pw:'2106', count:8, roster:{1:'이름', …}, mulTaught:5,
  dailyGoal:30, classGoal:150,
  focus:{ add:'a6', sub:'sm', mul:[7,8] }, updatedAt }
```
`mulTaught` 1~5는 배운 곱셈 묶음입니다. 1이면 2·5단, 2면 3·6단까지, 3이면 4·8단까지, 4면 7·9단까지, 5면 1단·0의 곱까지입니다. 이 값에 따라 던전 층이 잠기거나 열립니다.

## 7. 교사 기록장 개발 안내

교사 화면 코드는 `js/app.js`의 `dashboard` 구역에 모여 있습니다.

| 함수 | 역할 |
|---|---|
| `openDash` | 기록 불러오기, `students` 실시간 구독 |
| `dashClass` | 학급 현황 탭 |
| `dashStudent` | 학생별 보기 탭 (왼쪽 목록 + 단원 3열) |
| `dashMul` | 곱셈구구 지도 탭 |
| `dashSet` / `bindSet` | 설정 탭과 저장 |
| `gradeOf` | 등급 계산 (최근 30문제, 정확도 90/70% 기준, 쓰기 시간 덧셈·뺄셈 8초·곱셈 4초) |
| `reachedText`, `masteredMul` | 도달 수준 문구. 곱셈 숙달 기준은 `factMastered`(2회 이상, 80% 이상, 평균 5초 이하) |
| `evalText` | 평가 문장 초안 (기록된 숫자로만 만듦) |
| `csv` | CSV 내보내기 내용 |

탭을 추가하려면 `index.html`의 `#tabs`에 버튼을 하나 넣고 `renderDash()`에 분기를 하나 추가하면 됩니다. 교사 화면 스타일은 `css/style.css`에서 `.dash`, `.dcard`, `.kpi`, `.tblwrap` 등을 쓰고, `body.paper`일 때 적용됩니다.

### 교사 기록장에서 다음에 하면 좋은 것
1. 교사 로그인을 Firebase Auth로 교체 (3절)
2. 주간·월간 보고서 탭: `daily`, `sessions`로 기간별 정확도 추이 그리기
3. 학생 비교 없이 한 학생의 단원별 성장 그래프를 인쇄용 한 장으로 만들기
4. 집중 과제를 학생별로 다르게 주기 (`config/class.focus`를 `students/sNN.focus`로 옮기기)
5. 기록 백업/복원 (CSV 외에 JSON 전체 내보내기)

## 8. 화면 기준

- 학생 화면은 태블릿 가로(1024px 이상)에서 게임 화면 왼쪽, 조작부 오른쪽 배치입니다. 900px 미만에서는 위아래로 쌓입니다.
- 교사 화면은 PC 1280~1440px 기준입니다. 학생별 보기는 1260px 이상에서 단원 3열입니다.
- 게임 캔버스는 192×144 논리 픽셀을 `image-rendering: pixelated`로 키웁니다. 그림은 모두 `SPR` 문자열 스프라이트라 이미지 파일이 없습니다.

## 9. 알려진 한계

- 읽어 주기는 기기에 설치된 한국어 음성을 씁니다. 한국어 음성이 없는 기기에서는 소리가 나지 않습니다.
- 소리는 학생이 화면을 한 번 누른 뒤부터 납니다 (브라우저 정책).
- 기기 저장 모드에서 같은 번호를 두 태블릿이 쓰면 기록이 합쳐지지 않습니다. 저장소를 연결하면 마지막에 저장한 기기가 이깁니다 (`updatedAt` 비교).
- 우리 반 보물상자 숫자는 20초마다 한 번 다시 셉니다.
