# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-auth-errorcode-drift.md`

## 검토 범위와 방법

target 은 `spec/5-system/3-error-handling.md` 단 하나를 `spec_impact` 로 선언한 draft다.
두 정정을 제안한다: ① `ACCOUNT_LOCKED` 카탈로그 HTTP 코드 `423` → `401`, ②
`ALERT_RULE_NOT_FOUND`(404) 를 §1.3 에 신규 등재. 프롬프트 번들이 예산 초과로 대부분의
`spec/**` 파일을 절단했기 때문에(완전 포함된 건 `9-user-profile.md`·`3-error-handling.md`
둘뿐), 저장소의 실제 `spec/**`·`codebase/backend/src/**` 를 직접 열어 교차 검증했다.

## 실측 재확인

| 검사 | 결과 |
| --- | --- |
| `spec/5-system/3-error-handling.md:48` 현재 값 | `423` (draft 반영 전, 확인) |
| `grep -rn "423" spec/` | `3-error-handling.md` 본문·Rationale 문구 2건 외 **타 영역 0건** (나머지는 무관한 cafe24 카탈로그 이미지 URL) |
| `spec/data-flow/2-auth.md:70,331` | 이미 `401` — draft 의 수정 방향과 **일치**(충돌 아니라 정합화) |
| `spec/5-system/2-api-convention.md §6`(HTTP 상태 코드 표, SoT) | 이 API 가 실제로 쓰는 상태 코드 목록에 **423 은 애초에 없음**(200/201/204/400/401/403/404/409/413/422/429/500/503) — "카탈로그가 처음부터 틀렸다" 는 draft 의 결론을 뒷받침하는 추가 증거 |
| `codebase/frontend/src` 내 `423`/`ACCOUNT_LOCKED`/`ALERT_RULE_NOT_FOUND` 참조 | 0건 — 클라이언트 어느 쪽도 423 을 분기하지 않음 |
| `spec/2-navigation/9-user-profile.md §6.3` (PATCH/DELETE `/api/alerts/:id`) | 이미 `404 ALERT_RULE_NOT_FOUND` 로 문서화(기능 spec 쪽), draft 는 이 문구를 그대로 두고 카탈로그만 신규 등재 — 중복·모순 없음 |
| `codebase/backend/src/modules/alerts/alerts.service.ts:49,66` | `NotFoundException({code:'ALERT_RULE_NOT_FOUND'})`, `where:{id, workspaceId}` — draft 의 "타 워크스페이스 접근도 동일 404(존재 누설 방지)" 서술과 일치 |
| `spec/1-data-model.md §2.25 AlertRule` | 같은 브랜치의 선행 커밋(`84f59cc9c`, `#1247`)이 오늘 신설. draft 의 `§6.3` API 표가 참조하는 `1-data-model.md §2.25 AlertRule` 링크가 **이미 존재**함을 확인 — dangling 참조 아님 |
| `spec/conventions/error-codes.md` | "카탈로그·분류·트리거의 SoT = `3-error-handling.md §1`" 을 명시 — draft 가 §1.3 에 직접 등재하려는 방향과 정합. `<DOMAIN>_<CONDITION>` 명명 원칙에도 `ALERT_RULE_NOT_FOUND` 는 부합 |
| `spec/5-system/1-auth.md` RBAC 매트릭스(§3.2) | 알림 규칙(`alert`) 관련 행 없음 — draft 가 손대지 않는 RBAC 영역과 무간섭 |
| `spec/data-flow/9-observability.md §1.3/§2.1` | `alert_rule` 데이터·평가 흐름만 서술, 에러 코드 재정의 없음 — 중복 정의 없음 |

## 발견사항

### INFO — 같은 문서 내 Rationale 서술이 이 draft 의 편집으로 낡아짐 (`3-error-handling.md` §1 Rationale)
- target 위치: draft 본문 자체(§① 처방) — 실제 편집 대상은 `spec/5-system/3-error-handling.md:48`
- 충돌 대상: 같은 파일의 `## Rationale` 중 "§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재" 항목(`spec/5-system/3-error-handling.md:551`)
- 상세: 이 Rationale 문장은 `NOT_A_MEMBER`·`INVALID_PASSWORD` 를 §1.2 에 배치한 근거로 "**§1.2 의 401/403/423 구조**" 를 든다. draft 가 `ACCOUNT_LOCKED` 를 423→401 로 고치면 §1.2 표에는 더 이상 423 항목이 하나도 남지 않아, 이 서술은 편집 시점부터 사실과 어긋난다. 다른 영역과의 충돌은 아니고 같은 파일 내 본문-vs-Rationale 드리프트라 엄밀히는 "cross-spec" 범위 밖일 수 있으나, draft 의 편집이 직접 만들어내는 낡음이라 여기서 짚어둔다.
- 제안: `3-error-handling.md:48` 을 401 로 고칠 때, 같은 커밋에서 그 Rationale 문구를 "401/403 구조"로(또는 "당시엔 401/403/423" 식 과거형으로) 함께 정정. 이 draft 의 `spec_impact` 범위(같은 파일) 안이라 별도 planner 턴 불요.

## 요약

target 이 제안하는 두 정정(`ACCOUNT_LOCKED` 423→401, `ALERT_RULE_NOT_FOUND` 신규 등재)은 모두
**다른 영역과 충돌을 만드는 변경이 아니라 기존에 이미 정합했던 다수 SoT(구현·`data-flow/2-auth.md`·
`2-api-convention.md §6`·`9-user-profile.md §6.3`·`alerts.service.ts`)에 카탈로그 하나를 뒤늦게
맞추는 수정**이다. `423` 문자열은 저장소 전체에서 이 카탈로그 한 줄에만 존재했고(타 영역 참조
0건, 클라이언트 분기 0건), `2-api-convention.md` 의 정본 HTTP 상태 코드 표에도 애초에 423 이
없어 draft 의 "처음부터 틀렸다" 판단을 추가로 뒷받침한다. `ALERT_RULE_NOT_FOUND` 등재는 명명
규약·배치 선례(`MODEL_CONFIG_NOT_FOUND`)·RBAC·데이터 모델(§2.25, 같은 브랜치 선행 커밋으로 이미
존재) 어느 축과도 모순되지 않는다. 유일한 지적은 같은 파일 안의 Rationale 문구가 이번 편집으로
낡는다는 INFO 1건이며, 이는 cross-spec 충돌이 아니라 draft 적용 시 같은 파일 안에서 함께 고치면
끝나는 사소한 후속 작업이다.

## 위험도

LOW
