/* 저장소 연결 설정
 *
 * 앱은 window.MRQ_DB 에 담긴 저장소를 씁니다.
 *  1) 아래 MRQ_FIREBASE 가 null 이면 → 각 기기(localStorage)에만 저장. 교사 기록장은 그 기기의 기록만 봄.
 *  2) MRQ_FIREBASE 에 Firebase 웹 앱 설정을 넣으면 → 모든 태블릿 기록이 교사 PC로 실시간으로 모임.
 *     Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 의 firebaseConfig 값 4개를 그대로 옮겨 적으면 됩니다.
 *     Firestore 와 Authentication(익명 로그인)을 켜고 firestore.rules 를 올려야 해요. (docs/HANDOFF.md 2-2절)
 *  3) claude.ai 아티팩트 안에서 열면 → claude.ai 저장소를 자동으로 씀. (MRQ_FIREBASE 가 null 일 때)
 *
 * MRQ_DB가 갖춰야 할 모양 (Firestore compat API와 같음):
 *   MRQ_DB.doc('students/s01').get()  → Promise<{id, exists, data()}>
 *   MRQ_DB.doc('students/s01').set(obj) → Promise
 *   MRQ_DB.collection('students').get() → Promise<{docs:[{id,exists,data()}]}>
 *   MRQ_DB.collection('students').onSnapshot(next, error) → unsubscribe 함수
 * Promise를 넣어도 됩니다. 연결에 실패하면 null → 기기 저장으로 동작해요.
 */
const MRQ_FIREBASE = null;
// 예: const MRQ_FIREBASE = { apiKey: '...', authDomain: '...firebaseapp.com', projectId: '...', appId: '...' };

if (MRQ_FIREBASE) {
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const load = f => new Promise((ok, no) => { const s = document.createElement('script'); s.src = SDK + f; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  window.MRQ_DB = (async () => {
    await load('firebase-app-compat.js');
    await Promise.all([load('firebase-auth-compat.js'), load('firebase-firestore-compat.js')]);
    firebase.initializeApp(MRQ_FIREBASE);
    const fsdb = firebase.firestore();
    fsdb.settings({ ignoreUndefinedProperties: true });
    await firebase.auth().signInAnonymously();
    return fsdb;
  })().catch(() => null);
}
