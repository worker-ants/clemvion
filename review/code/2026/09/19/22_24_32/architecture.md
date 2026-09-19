# 아키텍처 리뷰 — SMTP SSRF 가드 통합 (3라운드 · 최종 수렴 확인)

이 라운드는 `origin/main` 대비 누적 diff 전체(1·2라운드 리뷰 산출물 포함)를 다시 훑어, 앞선 두 라운드의
architecture WARNING 이 실제로 해소됐는지 코드를 직접 열어 재확인했다. 이 세션 자신은 저장소 파일을 수정하지
않았다(`Read`/`Grep` 만 사용).

## 저장소 이상 상태 관측 (내가 만들지 않음, 이후 자연 소멸)

리뷰 도중 `git status --short` 에서 아래 uncommitted 변경이 한때 관측됐다 — **이 세션이 만든 변경이 아니다**
(이 파일은 `Read` 로만 열었다). 병렬로 같은 워킹트리를 쓰는 다른 reviewer 의 뮤테이션 검증 작업으로 추정된다
(CGNAT 대역 상한을 한 옥텟 낮춘 형태로, 경계값 판별력을 확인하는 전형적인 boundary mutation 과 일치).

```
M codebase/backend/src/nodes/integration/http-request/http-safety.ts
```

```diff
-  [ipToInt(100, 64, 0, 0), ipToInt(100, 127, 255, 255)],
+  [ipToInt(100, 64, 0, 0), ipToInt(100, 126, 255, 255)],
```

`git checkout`/`git restore` 로 되돌리지 않았다 — 다른 세션의 진행 중 작업일 수 있어 프로젝트 뮤테이션 규약이
금지한다. **후속 확인**: 이 보고서를 마무리하기 직전 `git status --short` 를 다시 돌리니 이미 clean 이었다 — 그
reviewer 가 자신의 뮤테이션 검증을 끝내고 직접 원복한 것으로 보이며, 이 세션이 원복한 것은 아니다. 병합 시점에는
사라져 있을 가능성이 높지만, 혹시 재출현하면(같은 라운드 안에서 또는 병합 직전) mutation-testing 잔여물일 수
있음을 참고하라 — 그 상태로 커밋되면 CGNAT 대역 상한이 `100.126.255.255` 로 줄어 `100.127.0.0/24` 가 차단
대상에서 빠지는 실제 결함이 된다.

## 이전 라운드 WARNING 재확인

- **[해소 확인]** 2라운드 WARNING #2("헤더 주석이 트래커에 항목이 있다고 현재형으로 단언하지만 실제로는 없다") —
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4898~4901 에 "공용 SSRF 가드 `http-safety.ts`
  를 `http-request/` 밖 중립 위치로" 항목이 실제로 등재됐다(`developer + planner, 낮음, 2026-09-19 등재`). 같은 커밋
  (`fce34b77b`)에서 `http-safety.ts` 헤더 문구도 "트래커 … 의 항목으로 둔다"로 정정됐다. 주석·트래커·실물이 이제
  일치한다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:26`~`28`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4898`~`4901`
- **[해소 확인]** 2라운드 maintainability WARNING("JSDoc 문단 끼어듦으로 영어 문장 흐름이 끊김") — 현재 헤더는
  `Blocks URLs...` → `Intended for Integration-backed requests...` → `Two layers:` → `Self-hosted opt-in...` 순
  영어 문단이 끊기지 않고 이어지고, 폴더 위치를 설명하는 한국어 문단은 빈 줄로 분리되어 파일 맨 끝(게이트 26~28)에
  배치됐다. 재론할 거리 없음.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:1`~`29`
- **[수렴 예외 — 재확인, 재지적 아님]** 2라운드 WARNING #1("`SsrfBlockedError` 판별 계약이 5개 소비자 중
  `smtp-host-guard.ts` 1곳에만 적용됐다") — `review/code/2026/09/19/22_00_32/RESOLUTION.md` 가 developer SKILL
  §ISSUE FIX 정책에 따라 명시적으로 수렴 예외 처리했고(동작 회귀 없음 · 4개 호출부 동시 변경은 별도 라운드가 필요한
  범위 확장 · 트래커 등재), 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트
  4903~4907 에 "SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로" 항목이 등재되어 있다.
  `http-request.handler.ts:352`(`catch (err) { const detail = err instanceof Error ? err.message : String(err); ...HTTP_BLOCKED }`),
  `http-redirect.ts:29`, `database-connection-tester.ts`·`database-query.handler.ts` 의 대응 catch 는 현재도 여전히
  "무엇이든 차단으로 승격"하는 blanket catch 다 — 코드 상태는 2라운드 시점과 동일하며 새로 발견된 것이 아니다.
  정책상 처분된 항목을 다시 Warning 으로 올리지 않는다(재확인만).
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:352`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:24`~`29`

## 이번 라운드에서 새로 본 것

- **[INFO]** `http-safety.ts` 의 모듈 docstring(게이트 1~4)이 이제 세 노드(HTTP Request · DB Query · Send Email)를
  모두 명시하고 SMTP 경유 파일(`send-email/smtp-host-guard.ts`)까지 정확히 가리켜, "공용 SoT" 라는 서술과 실제
  소비자 목록이 일치한다 — 1라운드 시점에는 이 헤더가 SMTP 를 언급하지 않았다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:1`~`5`
- **[INFO]** `smtp-host-guard.ts` 는 여전히 얇은 어댑터(1개 함수, 판정 위임 + `instanceof` 분기)로 남아 단일
  책임을 지키고, `http-request/` → `send-email/` 방향의 순환은 재확인 결과 없다(`grep -rn "send-email\|database-query"
  codebase/backend/src/nodes/integration/http-request/` 결과 없음, 앞 라운드와 동일 결론).
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 전체
- 나머지(CHANGELOG·`.env.example`·문서·plan 트래커·타 라운드 리뷰 산출물)는 구조적 관점의 신규 결합/순환/레이어
  위반을 만들지 않는 문서·설정·산출물 변경이다.

## 순환 의존성

`http-request/` ↔ `send-email/`, `http-request/` ↔ `database-query/` 양방향 모두 재확인 — 역참조 없음. 순환 없음.

## 요약

1·2라운드에서 제기된 architecture 관점 WARNING 둘(트래커 현재형 단언의 거짓 · JSDoc 문단 끼어듦은 maintainability
축)은 이번 라운드에 실제 코드·트래커 파일 대조로 해소를 확인했다. 유일하게 남아 있던 구조적 트레이드오프
(`SsrfBlockedError` 타입 판별이 5개 소비자 중 1곳에만 적용된 상태)는 프로젝트 정책상 정식으로 "수렴 예외" 처리되고
트래커에 등재되어 있어, 코드 상태가 2라운드와 동일하더라도 재지적 대상이 아니다 — 재확인 결과만 기록한다. 새로
발견된 순환 의존·레이어 붕괴·SOLID 위반은 없다(이번 라운드의 실질 변경분인 CHANGELOG·`.env.example`·JSDoc·트래커
등재는 모두 문서/설정 성격이라 구조에 미치는 영향이 없다). 리뷰 도중 이 세션이 만들지 않은 uncommitted 변경
(`http-safety.ts` 의 CGNAT 상한 1옥텟 축소, 다른 reviewer 의 뮤테이션 검증으로 추정)을 한때 관측했으나, 보고서
마무리 시점에는 이미 원복되어 clean 상태였다 — 위 "저장소 이상 상태 관측" 절 참고.

## 위험도

NONE
