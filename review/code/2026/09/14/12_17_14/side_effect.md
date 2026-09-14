# 부작용(Side Effect) 리뷰

## 범위 요약

이 세션은 `trigger-canary-hardening` 배치의 **세 번째** `/ai-review` 라운드다(`efb0e4b36` →
라운드1 fix `4c1a49b30` → 라운드2 fix `3f5e451b3`). 실질 코드 diff(`origin/main...HEAD --
codebase/`)는 여전히 6개 파일(+357/-23)로, 프로덕션 코드(`codebase/backend/src/modules/**`)는
전혀 건드리지 않는다. 나머지 50개 파일은 `plan/**` 2개와 `review/code/**`·`review/consistency/**`
산출물(과거 두 라운드의 리뷰·컨시스턴시 리포트)이며 코드 실행 경로와 무관하다.

라운드2 fix(`3f5e451b3`)가 코드에 낸 유일한 변경은
`codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`의 **14줄**뿐이다 —
(1) 불필요한 중첩 템플릿 리터럴 제거, (2) `existsSync` 방어 분기를 실제로 CI 에 묶는 신규
`it()` 1건 추가(`.toThrow(/옮겨졌거나 이름이 바뀌었다/)`, 기존 `tmp`/`write` 헬퍼 재사용, 신규
파일시스템 자원 없음). 아래는 6개 코드 파일 전체를 직접 열람해 독립적으로 재검증한 결과다(이전
두 라운드의 side_effect 리포트 서술을 그대로 인용하지 않고, `Read`로 소스를 재대조했다).

## 발견사항

- **[INFO]** 신규 guard 함수(`readStringArrayConst`/`readAllTriggerSecretColumnLists`)는 순수 읽기 — 전역/공유 상태 변경 없음, fail-loud 설계는 의도적
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` `readStringArrayConst`(함수 선언 게이트 46~106) / `readAllTriggerSecretColumnLists`(게이트 108~123)
  - 상세: `repoRoot`/`relPath`/`constName` 인자만으로 동작하고 `fs.readFileSync`로 읽기만 한다 — 모듈 스코프 mutable 상태(캐시 등)가 없어 반복 호출 간 오염이 없다. `CANONICAL_SOURCE`/`MIRROR_SOURCES` 3개 대상 파일이 사라지면 `fs.existsSync` 검사 후 명시적 `Error`를 던진다(게이트 54~59) — 이는 "가드가 깨졌다" vs "대상이 리네임됐다"를 구분하려는 의도된 fail-loud 동작이라 부작용으로 분류하지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 spec 의 파일시스템 쓰기는 `os.tmpdir()` 격리 + `afterAll` 정리로 저장소 트리 밖에 완전히 봉쇄됨(직접 소스 대조로 확인)
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` `beforeAll`/`afterAll`/`write` 헬퍼(파일 내 `describe('[대조군] readStringArrayConst …')` 블록, 현재 파일 97~109행)
  - 상세: `tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))`로 매 실행마다 고유 접미사 디렉터리를 만들고, `afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))`로 확실히 제거한다. `write()` 헬퍼는 이 `tmp` 안에만 쓴다. 저장소(`codebase/**`) 안에는 아무것도 쓰지 않으며, 병렬 실행 중인 다른 Jest worker/리뷰어와 경로가 겹칠 위험도 없다(매 실행 랜덤 접미사). 라운드2 fix가 추가한 신규 `it()`(`대상 파일이 없으면 …`)도 이미 만들어진 `tmp`/`write` 인프라를 그대로 재사용할 뿐 새 자원을 만들지 않는다 — 존재하지 않는 경로(`'definitely-absent.ts'`)를 대상으로 하므로 오히려 쓰기가 발생하지 않는 케이스다.
  - 제안: 없음.
  - 참고(엣지케이스, 결함 아님): `beforeAll`에서 `mkdtempSync`가 실패하면 `tmp`가 미할당인 채 `afterAll`의 `fs.rmSync(tmp, …)`가 `TypeError`를 낼 수 있다. `os.tmpdir()` 쓰기 실패는 CI 환경에서 사실상 발생하지 않는 시나리오이고 실패 시에도 "저장소 파일을 잘못 지우는" 방향이 아니라 추가 실패로만 이어지므로 위험도에 반영하지 않았다.

- **[INFO]** e2e 3곳에 추가된 `expectTriggerWorkflowRef(...)` 호출은 기존 export 헬퍼를 그대로 재사용 — 시그니처·구현 모두 이번 diff 밖(unchanged), 신규 네트워크/DB 호출 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — import 게이트 13, 호출부 게이트 277~280(C-2 목록 케이스)·392~395(G, PATCH cron)·429~432(H, PATCH 재활성)
  - 상세: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`를 직접 열람해 확인 — 이 파일 자체는 이번 diff에 포함되지 않았고, `expectTriggerWorkflowRef(dto: unknown, opts: { present: boolean; expectedWorkflowId?: string })`는 `expect()` 단언만 수행하는 순수 함수다(내부에 `fetch`/DB 쿼리/타이머/전역 변수 갱신 없음). 새로 추가된 세 호출 모두 이미 HTTP 응답으로 받아온 `row`/`patch.body.data`에 대해 사후 검증만 하므로 추가 HTTP/DB 왕복이 생기지 않는다.
  - 제안: 없음.

- **[INFO]** `trigger-workflow-ref.e2e-spec.ts`의 `afterAll` 관련 변경은 JSDoc(근거 서술)만 — 실제 teardown 로직은 이번 라운드까지 포함해 바이트 단위로 동일함을 직접 확인
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` JSDoc(게이트 144~168 부근), `afterAll` 본문(게이트 169~172, `for (const id of createdTriggerIds) … db.query('DELETE FROM trigger …').catch(...)`; `await db.end()`)
  - 상세: 소스를 직접 열어 `afterAll` 구현부가 diff 헝크 밖에 있음을 재확인했다 — 자매 파일 `chat-channel-trigger-create.e2e-spec.ts`도 정본을 가리키는 주석 4줄만 추가됐고 `afterAll` 로직은 그대로다. "e2e가 `secret_store`에 고아 row를 남긴다"는 부작용 자체는 이번 PR 이전부터 존재했고, 이번 라운드는 그 무해성 근거를 "미검증"에서 "두 경계 실측"으로 문서만 승격했을 뿐 회귀나 신규 위험이 아니다.
  - 제안: 없음.

- **[INFO]** `review/code/**`·`review/consistency/**`·`plan/**` 44개 파일은 harness 관례상 정상적인 신규 산출물 — 런타임 부작용과 무관
  - 위치: `plan/in-progress/trigger-canary-hardening.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/14/{11_27_40,11_52_13}/**`, `review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23}/**`
  - 상세: 전부 CLAUDE.md가 지정한 저장 위치(`review/code/**`, `review/consistency/**`, `plan/in-progress/**`) 그대로의 신규 파일 생성 또는 체크박스/각주 갱신이며 코드 실행 경로에 영향을 주는 로직이 아니다. 라운드2 fix 커밋(`3f5e451b3`)의 stat을 직접 대조해 코드 변경이 `trigger-secret-columns.spec.ts` 14줄뿐임을 확인했다.
  - 제안: 없음.

## 검증한 사항

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 전체를 `Read`로 직접 열람 — `tmp`/`write` 인프라, `beforeAll`/`afterAll` 짝, 신규 `it()` 모두 저장소 트리 밖에서만 동작함을 확인.
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`(비-diff 파일)를 직접 열람 — `expectTriggerWorkflowRef` 시그니처·구현이 순수 assertion 함수임을 확인, 새 호출부가 시그니처를 바꾸거나 새 부작용을 유발하지 않음.
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`의 `afterAll` 본문을 직접 열람 — JSDoc 변경과 무관하게 정리 로직이 동일함을 확인.
- `git show --stat 3f5e451b3` / `git show -- codebase/.../trigger-secret-columns.spec.ts`로 라운드2 fix가 코드 쪽에 낸 변경이 14줄(템플릿 리터럴 정리 + 신규 방어-분기 테스트 1건)뿐임을 확인 — 새로운 전역 상태·환경 변수·네트워크 호출을 도입하지 않는다.
- 저장소 트리에 어떤 파일도 쓰거나 수정하지 않았다(`git status --short` 확인 불필요 — Read 전용으로 진행, 뮤테이션 없음).

## 요약

이번 diff는 여전히 프로덕션 서비스 코드를 전혀 수정하지 않는다. 라운드2 fix가 추가한 유일한
코드 변경(`trigger-secret-columns.spec.ts` 14줄)은 기존에 이미 격리돼 있던 `os.tmpdir()`
인프라를 재사용하는 신규 단언 1건과 사소한 스타일 정리뿐이라 새로운 부작용 표면을 만들지 않는다.
e2e 3곳의 `expectTriggerWorkflowRef` 호출은 시그니처·구현이 불변인 기존 순수 assertion 헬퍼를
재사용할 뿐이고, `trigger-workflow-ref.e2e-spec.ts`의 teardown 관련 변경은 JSDoc 근거 서술
승격뿐 실제 정리 로직은 동일함을 소스 직접 대조로 재확인했다. 새 전역 상태·환경 변수 읽기쓰기·
네트워크 호출·함수 시그니처 변경·이벤트/콜백 변경 어느 것도 관측되지 않는다.

## 위험도

NONE
