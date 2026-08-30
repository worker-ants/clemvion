# 요구사항(Requirement) 리뷰

## 리뷰 범위 확정

`origin/main` 은 이미 `98563ef0a`(#1239, planner 턴 spec 정정)까지 반영돼 있고, 대상 커밋은 그
바로 다음 `10f7a2350` 한 개다(`git show --name-status 10f7a2350`):

```
M  codebase/backend/src/modules/websocket/websocket.service.spec.ts
R  plan/in-progress/spec-draft-followups-drain-2026-08-30.md → plan/complete/…
R  plan/in-progress/ws-event-types-extract.md → plan/complete/…
M  plan/in-progress/spec-sync-external-interaction-api-gaps.md
```

프롬프트에는 두 rename 이 "새 파일 전체 추가 + 옛 파일 전체 삭제" 로 펼쳐져 실려 있지만(diff 도구가
rename 을 인식하지 못한 조립 산출물), 실제 git 이력은 `git mv` 기반 rename(R099/R096)이다 —
내용은 동일하다.

## 검증 절차 (재현)

- `npx jest src/modules/websocket/websocket.service.spec.ts src/modules/websocket/websocket-events.types.spec.ts` → **2 suites / 76 tests 전부 PASS**
- `npx jest src/modules/websocket` (모듈 디렉터리 전수) → **7 suites / 173 tests 전부 PASS** — plan 이 적어 둔 "173 tests(172→+1)" 실측과 정확히 일치(디렉터리 합계 기준이었음을 확인)
- `npx vitest run` (`plan-frontmatter` · `spec-link-integrity` · `plan-scan` · `spec-plan-completion`) → **4 files / 1166 tests 전부 PASS** — 두 plan rename 이 DEAD 링크·frontmatter 위반을 만들지 않음을 직접 재현 확인
- `grep -rn "InAppNotificationEventType"` (전 backend) → `websocket-events.types.ts` 선언 + `websocket.service.ts` re-export(import·export 양쪽) + 신규 spec 3곳만 존재. 나머지 세 enum(`ExecutionEventType`·`NodeEventType`·`BackgroundRunEventType`) 은 같은 spec 파일에서 각각 36·12·10회 실사용 중 — "재수출이 끊기면 컴파일이 깨진다" 는 JSDoc 주장과 일치
- 저장소 뮤테이션 없음. `git status --short` 최종 확인 결과 `review/code/2026/08/30/` 산출물 외 잔여물 없음

> 조사 중 절대경로(`/Users/…/doliolid/codebase/...`)로 grep 했다가 이 worktree 밖의 **main 체크아웃**(다른 브랜치 상태)을 잘못 짚어 "개명이 실제로는 안 됐다"는 거짓 경보를 한 번 냈다 — worktree 상대경로로 재확인해 해소했다. 오탐이었음을 여기 기록한다(리포트에는 반영 안 함).

## 발견사항

없음 (Critical/Warning 0). 관측한 INFO 만 기록한다.

- **[INFO]** `plan/complete/spec-draft-egress-masking-convention.md:118,138` 와
  `plan/complete/spec-draft-ws-types-canonical-location.md:9`(frontmatter `pending_plans`)가
  여전히 `plan/in-progress/ws-event-types-extract.md`(이번에 옮겨진 옛 경로)를 가리킨다.
  - 위치: `plan/complete/spec-draft-egress-masking-convention.md:118`, `:138`;
    `plan/complete/spec-draft-ws-types-canonical-location.md:9`
  - 상세: 실제로는 결함이 아니다 — `.claude/docs/plan-lifecycle.md §3/§4` 가 `plan/complete/**`
    출처 문서는 "시점 기록" 이라 옛 경로 유지를 **규약으로 명시**하고, link-integrity guard 도
    `plan/complete/**` 를 검사 대상에서 명시적으로 제외한다(§4: "`plan/complete/**` 는 대상이
    아니다"). 이번 커밋의 plan 본문(`plan/complete/ws-event-types-extract.md` 의 체크리스트
    항목)도 "인입 링크는 살아있는 문서 둘뿐이고 `plan/complete/**` 4건은 시점 기록이라 옛 경로
    유지가 규약" 이라고 스스로 명시하고 있고, 실측 grep 건수도 그 서술과 일치한다.
    `spec-link-integrity` 테스트 실행으로 RED 가 없음을 직접 재현 확인했다.
  - 제안: 조치 불요. 정책이 의도한 상태다.

- **[INFO]** `websocket.service.spec.ts` 신규 `describe('re-export facade')` 블록은
  `websocket-events.types.spec.ts` 의 `REEXPORT_FACADE_TEST` allowlist 가 이 파일 하나만
  eager 값 import 예외로 인정하는 것과 맞물려 있다 — 이 파일이 없어지거나 경로가 바뀌면
  그 guard 의 "facade 테스트가 실제로 존재한다" 단언이 RED 로 잡는 구조를 실측으로 확인했다
  (`fs.existsSync(REEXPORT_FACADE_TEST)`). 결함 아님, 설계 의도가 코드로 실제 강제됨을 확인.

## 항목별 점검 결과

1. **기능 완전성**: plan 이 명시한 "fix 는 한 줄 — facade 경유 import + `NOTIFICATION_NEW ===
   'notification.new'` 단언" 을 그대로, 정확히 구현. 커버리지 비대칭(나머지 3개 enum 은 실사용으로
   덮이는데 `InAppNotificationEventType` 만 안 덮이던 문제)이 실측으로 해소됨.
2. **엣지 케이스**: 대상 enum 이 단일 멤버(`NOTIFICATION_NEW` 하나)라 경계값 이슈 자체가 없음.
3. **TODO/FIXME**: diff 전체에 TODO/FIXME/HACK/XXX 없음.
4. **의도-구현 괴리**: `describe`/`it` 이름, JSDoc 서술("이 spec 이 facade 의 유일한 소비자")이
   실제 코드·가드 구조와 line-level 로 일치. 과장·오기 없음.
5. **에러 시나리오**: 해당 없음 — 이 변경은 순수 계약 테스트 추가이고 새 에러 경로를 만들지 않음.
6. **데이터 유효성**: 해당 없음.
7. **비즈니스 로직**: enum wire 값(`notification.new`)은 로직 변경이 아니라 기존 상수를 검증만 함.
8. **반환값**: 해당 없음(단언 테스트).
9. **spec fidelity**: `spec/5-system/6-websocket-protocol.md:863`("`notification.new` |
   `{ id, type, title, message, resourceType, resourceId }`")과 코드 선언부 JSDoc("권위 정의:
   spec/5-system/6-websocket-protocol.md §4.4")이 가리키는 값이 테스트 단언과 정확히 일치.
   plan 파일들의 `spec_impact` frontmatter(7개 파일)도 실측 `git show --stat` 근거와 일치하며
   Gate C 요건(`status: complete` + `spec_impact` 비어있지 않음)을 충족.

## 요약

대상 커밋(`10f7a2350`)은 이전 세션이 트래커에 남겨 둔 "facade 재수출 커버리지 비대칭" 한 줄짜리
후속 항목을 정확히 그 계획대로 집행한 것으로, `websocket.service.spec.ts` 에 재수출 facade 를
경유한 `InAppNotificationEventType.NOTIFICATION_NEW` 값 단언을 추가하고, 완료된 두 plan
(`ws-event-types-extract.md`, `spec-draft-followups-drain-2026-08-30.md`)을 `git mv` 로
`complete/` 로 옮기며 살아있는 인입 링크 1건을 갱신했다. 직접 테스트 실행(대상 spec 76/76,
모듈 전수 173/173, 문서 가드 4파일 1166/1166 전부 PASS)과 spec 본문 대조로 기능·spec 정합성을
모두 확인했으며 CRITICAL/WARNING 은 발견되지 않았다. plan/complete/** 문서 3곳에 남은 옛 경로
참조는 이 저장소의 명시된 "시점 기록 보존" 정책과 정확히 일치해 결함이 아니다.

## 위험도

NONE
