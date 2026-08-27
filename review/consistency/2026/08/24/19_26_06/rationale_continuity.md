# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, 실질 target: `plan/in-progress/masking-expression-egress-split.md`)

## 검토 범위 메모

번들은 `spec/5-system/` 18개 중 3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 전문이었고
나머지 15개(특히 `14-external-interaction-api.md`)는 예산 초과로 절단됐다. 절단된 파일은 이 작업이 실제로
건드리는 영역이라 `Read`/`grep` 으로 직접 열어 보완했다: `spec/5-system/14-external-interaction-api.md`
(`## Rationale` → R17), `spec/conventions/node-output.md` (Principle 7), `spec/conventions/egress-masking.md`,
`spec/2-navigation/14-execution-history.md` (R-5), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
(정본 트래커), 그리고 실제 변경 대상 `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
와 그 도입 커밋(`abc0acf68`).

이 작업(`masking-expression-egress-split`, worktree `masking-residuals-0b195b`)의 실체는 신규 spec 조항 추가가
아니라 **`handler-output.adapter.ts` 의 `maskSensitiveFields(r.config)` 호출(엔진 boundary 마스킹) 제거** 다.
`spec/5-system/` 자체에는 아직 아무 변경이 없으므로, 검토는 "target(구현 예정 변경)이 기존 spec 의
`## Rationale`/설계 원칙과 충돌하는가"로 수행했다.

## 발견사항

- **[CRITICAL]** `실행 내역 spec R-5` 의 안전 근거("저장 시점에 이미 마스킹")가 target 변경으로 거짓이 되는데, target 은 이를 정정하는 새 Rationale 을 아직 갖고 있지 않다
  - target 위치: `plan/in-progress/masking-expression-egress-split.md` §"안전성은 **키 집합 포함관계**에 걸려 있다" 표(`DB | 원문 보존`) + 작업 체크리스트 "어댑터에서 `maskSensitiveFields(config)` 제거"
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md:469` R-5(제목 자체가 "…viewer 롤에도 노출되지만 **안전한 이유**"):
    > "config echo 는 **엔진 boundary**(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 **DB·WS·REST 모든 경로**에 **보편 마스킹**되어 내려오므로(민감 필드는 **저장 시점에 이미 마스킹**), 노출 자체가 새로운 시크릿 유출 경로를 만들지 않는다. 즉 **안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존**한다"
  - 상세: R-5 는 Config 탭이 `@Roles` 게이트 없이 워크스페이스 viewer 전원에게 노출돼도 안전한 **유일한 근거**로 "어댑터가 DB 저장 시점에 이미 마스킹한다"를 명시적으로 지목한다. target 은 정확히 그 어댑터 마스킹을 제거하고 DB 를 "원문 보존"으로 바꾼다(계획 자신의 표에 명시). 그러면 R-5 의 전제("저장 시점에 이미 마스킹")는 문자 그대로 거짓이 된다 — 설사 REST 응답이 `redactStoredDataForResponse`(egress 시점, [EIA §R17](../../../../spec/5-system/14-external-interaction-api.md)) 로 여전히 가려진다 해도, 그것은 R-5 가 실제로 서술한 메커니즘(write-time boundary parity)과 다른 메커니즘(read-time egress parity)이다. "결론(viewer 에게 안전)이 우연히 유지될 수 있다"는 것과 "그 결론을 뒷받침하는 근거 문장이 여전히 참이다"는 것은 다르다 — 지금 상태로 구현하면 R-5 는 이미 반증된 근거를 계속 SoT 로 주장하게 된다.
  - 같은 결이 두 곳에서 더 확인된다:
    1. `spec/conventions/node-output.md` Principle 7 (자격증명 **"절대 echo 금지"**) 은 이 금지가 handler 의 의무이자 "egress 값-마스킹이 이 금지를 **backstop** 한다"고 명시한다 — 즉 egress 마스킹은 **핸들러 실수를 잡는 방어선**이지, 그 자체가 1차 방어를 대체해도 된다는 의미가 아니다.
    2. 어댑터 마스킹을 도입한 커밋(`abc0acf68`, INFO #5) 의 메시지 원문: *"NodeHandlerOutput.config JSDoc 의 'credential MUST be stripped' 컨트랙트를 runtime boundary 에서 강제 — 핸들러가 실수로 leak 해도 **DB 저장 / WS emit / 표현식 echo 모두 안전**"*. 세 표면 중 "DB 저장"이 명시적으로 이름 붙은 보호 대상이었다. target 은 이 세 표면 중 "표현식 echo" 만 의도적으로 되살리려 하면서, 어댑터가 **단일 boundary**라 "DB 저장"까지 함께 풀린다는 사실을 별도로 심의하지 않았다(아래 WARNING 항목 참조).
  - 제안: (a) 이번 developer PR 범위에서 `spec/2-navigation/14-execution-history.md` R-5 를 함께 갱신 대상으로 `spec_impact` 에 추가하거나(자기-반증형 소정정 요건은 R-5 를 developer 자신이 쓰지 않았으므로 미충족 — planner 턴 필요), (b) 최소한 이번 PR 의 planner 턴 작업 항목에 "R-5 정정(write-time parity → read-time parity 로 서술 변경 + 그 아래서도 안전함을 재확인)"을 명시적으로 추가한다. 지금 체크리스트는 `egress-masking.md` 만 언급해 R-5 가 빠져 있다.

- **[WARNING]** DB 저장 경로가 마스킹을 잃는 것이 "표현식 경로만 제외"라는 target 의 표제·트래커의 승인 범위보다 넓다
  - target 위치: `plan/in-progress/masking-expression-egress-split.md` 제목 "C2 (a) — **표현식 경로만** 마스킹에서 제외" / §"왜 '출구로 옮긴다' 가 아니라 '어댑터에서 뺀다' 인가"
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L588-615, 두 개의 인접·의도적으로 분리된 미체크 항목:
    - *"`DEFAULT_SENSITIVE_KEYS` 의 실질 위험은 정적 grep 으로 못 닫는다"* (재개 신호 충족 시 조치 (a) = "표현식 경로만 마스킹 제외")
    - 바로 다음 항목 *"자매 표면 `handler-output.adapter.ts` 의 값 축은 아직 열려 있다"* — "왜 같이 안 닫았나: 그 값은 **DB 저장 · WS emit · 표현식 echo** 로 흐른다... **분리 이유 자체가 규약이다** — 이 문서가 기록한 *'결합 항목을 한 체크박스로 닫으면 나머지가 조용히 사라진다'* 패턴을 피하려고 별도 항목으로 세웠다(`16_21_45` W5)."
  - 상세: 트래커 자신이 "config echo 는 DB·WS·표현식 세 표면을 동시에 흐르는 **단일 어댑터**를 지난다"는 사실을 알고, 값 축 확장 여부를 결정할 때 **일부러 그 세 표면을 한 체크박스로 묶지 않았다**(재발 패턴으로 명시 경계). target 은 정반대 방향(제거)에서 같은 위험을 재현한다 — "표현식 경로만"이라는 표제와 달리 실제 조치("어댑터에서 `maskSensitiveFields(config)` 제거")는 어댑터가 단일 boundary 이므로 DB·WS 소스 값까지 함께 원문화한다. WS/REST 는 하류 egress 마스커가 재차 가리므로 결과적으로 안전할 수 있지만(그 자체가 이번 PR 의 핵심 가설), **DB 저장이 원문화된다는 사실은 "표현식 경로만" 이라는 이름 아래 숨겨진 부수 결정**이다.
  - 제안: 작업 항목에 "DB 저장이 원문으로 바뀐다"를 별도 결정 문장으로 명시하고(트래커의 분리 관례를 따라), R-5·Principle 7 갱신과 함께 그 자체의 근거(egress-time 재마스킹으로 충분한 이유, 저장 시점 원문의 진단 가치 — 실은 credential 에는 그 가치가 없다는 점까지)를 적는다.

- **[WARNING]** "레이어드 마스킹은 경쟁하지 않고 쌓인다"는 기존 설계 철학과 target 의 "중복 제거" 프레이밍이 정면으로 반대다
  - target 위치: `plan/in-progress/masking-expression-egress-split.md` §"왜 '출구로 옮긴다' 가 아니라 '어댑터에서 뺀다' 인가" — *"이 작업은 '마스킹을 옮기는 리팩터' 가 아니라 '중복 한 겹을 걷어내는 것'"*
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` R17, ingestion-time(webhook 헤더) vs egress-time(Execution.error) 마스킹 병존을 정당화하며: *"**두 층은 경쟁하지 않고 쌓인다**: key-blacklist 가 못 잡는 값-패턴을 egress 층이 덮는다."*
  - 상세: 이 저장소의 명시된 설계 원칙은 "같은 목적의 마스킹 레이어가 둘이면 하나가 나머지의 사각지대를 덮는다"는 **의도된 다층 방어**이지, 자동으로 걷어내도 되는 낭비가 아니다. target 이 인용하는 "중복" 은 `mask-sensitive-fields.util.ts` 자신의 주석(2026-08-23)이 이미 *"이 목록은 **키 이름 완전 일치**"* 대 egress 의 `CREDENTIAL_KEY_PATTERN`(정규식, 접두 계열 포함)이라고 갈라 적은 **서로 다른 매칭 축**이다 — `#1202`(마스킹 게이트 4곳→헬퍼 2개 통합)가 "같은 자리의 같은 검사를 구현만 합친" 사례였던 것과 달리, 이번 target 은 "다른 시점·다른 매칭 축의 검사 하나를 아예 없애고 다른 축의 검사로 대체"하는 것이라 성격이 다르다. target 자체가 "포함관계 캐너리로 안전성을 실측한다"는 신중한 절차를 이미 계획하고 있어(§검증 기준) 방법론은 옳으나, 문서상 프레이밍("중복 제거")이 기존 Rationale 의 언어("층은 쌓인다")와 충돌한다는 점은 planner 턴에서 `egress-masking.md`/EIA §R17 근거를 갱신할 때 명시적으로 화해시켜야 한다 — 그러지 않으면 다음 사람이 "중복은 항상 제거 대상"이라는 잘못된 일반 원칙을 이 PR 에서 역으로 추출할 위험이 있다.

- **[INFO]** 재개 신호 자체는 정당 — 위 발견은 "하지 말라"가 아니라 "부수 결정을 명시하라"는 요청이다
  - target 이 인용하는 재개 조건(`config echo 를 다운스트림 표현식이 실제로 읽는 사례가 확인될 때`)과 제시된 조치 (a)(표현식 경로만 제외)는 트래커가 **사전에 승인해 둔 해법**과 정확히 일치한다(`spec-sync-external-interaction-api-gaps.md` L596-598). 즉 이 작업은 "기각된 대안의 재도입"이 아니라 **정당하게 재개된 백로그 항목의 집행**이다. 다만 집행 메커니즘(단일 어댑터 boundary 제거)이 트래커가 별도로 지목한 두 축(키축 vs 값축, 표현식 vs DB/WS)을 다시 결합하므로, planner 턴에서의 spec 갱신 시 그 결합을 명시적으로 재-분리해 서술해야 한다.

## 요약

이 작업은 실제로 발화한 재개 신호를 근거로 사전 승인된 해법(옵션 (a))을 집행하려는 것이라 "기각된 대안의 재도입"은 아니다. 그러나 구현 메커니즘(어댑터의 단일 `maskSensitiveFields(config)` 호출을 통째로 제거)은 "표현식 경로만"이라는 표제보다 넓어서, DB 저장 시점 마스킹을 유일한 안전 근거로 명시한 `spec/2-navigation/14-execution-history.md` R-5 를 사실상 반증하고, `spec/conventions/node-output.md` Principle 7 이 "backstop"으로 규정한 egress 마스킹을 1차 방어로 승격시키며, `EIA §R17` 의 "레이어는 경쟁하지 않고 쌓인다"는 명시적 설계 철학과도 프레이밍이 어긋난다. 이 저장소의 정본 트래커 자신이 "결합 항목을 한 체크박스로 닫으면 나머지가 조용히 사라진다"는 재발 패턴을 이미 명명해 두었는데, target 은 반대 방향(제거)에서 같은 결합을 만들고 있다. 현재 plan 의 `spec_impact` 는 `egress-masking.md` 하나뿐이라, R-5·Principle 7·EIA §R17 갱신이 빠질 경우 이 PR 이 랜딩된 뒤 spec 이 서로 다른 사실을 말하게 될 위험이 크다.

## 위험도

HIGH — 구현 자체(포함관계 캐너리 기반 접근)는 설계상 합리적이나, 최소 하나의 기존 spec 근거 문장(R-5)이 구현 직후 문자 그대로 거짓이 되고 이를 정정할 계획이 현재 `spec_impact`/작업 체크리스트에 없다. CRITICAL 로 격상하지 않은 이유는 (1) 재개 신호·해법 자체는 트래커가 사전 승인했고, (2) target 이 이미 `--consistency-check --impl-prep` 를 작업 항목에 포함해 이 검토를 예정하고 있으며, (3) planner 턴에서의 spec 반영이 이미 계획돼 있어(범위 누락일 뿐 완전 누락은 아님) 구조적으로 회수 가능하기 때문이다. 단, planner 턴 스코프에 R-5·Principle 7·EIA §R17 세 문서를 명시적으로 추가하지 않으면 착수를 재고해야 한다.
