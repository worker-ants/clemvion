---
title: "`token` 계열 값·키 패턴 마스킹 + EIA 저비용 문서 정정 3건"
worktree: eia-secret-pattern-token
started: 2026-08-17
owner: developer
status: in-progress
priority: P2
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/11-mcp-client.md
---

# `token` 계열 값-패턴 마스킹 + EIA 저비용 문서 정정 3건

트래커 `spec-sync-external-interaction-api-gaps.md` 의 **"`SECRET_LEAK_PATTERNS` 가 bare
`token=` 을 안 잡는다"** 항목 집행. 사용자가 프리필 가드(#1181) 다음 순서로 지정했다.

## 무수정 프로브 — 티켓보다 넓다

착수 전 3축 전수 측정. production 코드 변경 0:

```
=== 축 A: 값-패턴 (redactSecrets, 자유 텍스트) ===
  누출    token=sk-live-abc123
  누출    csrf_token=…  auth_token=…  session_token=…  csrfToken=…
  마스킹  access_token=…            ← 대조군

=== 축 B: 키-이름 (deepRedactSecrets) ===
  마스킹  {token:…}                  ← bare 는 이미 잡힌다
  누출    {csrf_token:…} {auth_token:…} {session_token:…} {csrfToken:…}

=== 축 C: 키-이름 (maskSensitiveFields, 로깅·workflow-assistant) ===
  마스킹  {token:…}
  누출    {csrf_token:…} {auth_token:…} {session_token:…} {csrfToken:…}
```

**티켓은 축 A 의 bare `token=` 한 칸만 말했다.** 실측하니 *접두 `token` 계열*이 **세 축
전부**에서 누출한다. 티켓이 지목한 비대칭(`secret` 은 단독 패턴이 있는데 `token` 은 없다)은
참이지만, 그것이 결함의 전부가 아니었다.

## 자매 전수 — 목록이 몇 개인가

`grep` 으로 센 결과 마스킹 목록은 **넷**이다:

| # | 위치 | 축 | bare `token` | 접두 계열 |
|---|---|---|---|---|
| 1 | `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` | 값 | **없음** | 없음 |
| 2 | `sanitize-error-message.ts` `CREDENTIAL_KEY_PATTERN` | 키 | 있음 | **없음** |
| 3 | `websocket.service.ts` `CREDENTIAL_KEY_PATTERN` | 키 | 있음 | **없음** |
| 4 | `mask-sensitive-fields.util.ts` `DEFAULT_SENSITIVE_KEYS` | 키 | 있음 | **없음** |

## 범위 결정

**닫는다: #1 · #2 · #3.** 이 셋은 EIA egress 마스킹의 SoT 쌍이고, 이 이니셔티브(#1177~#1181)가
계속 함께 다뤄 온 표면이다. #2·#3 은 JSDoc 이 서로를 *의도된 미러*로 명시하므로 한쪽만
고치면 그 주석이 거짓이 된다.

**닫지 않는다: #4 (`maskSensitiveFields`).** 이미 트래커의 **workflow-assistant 항목**이
소유하고 있고 사용자가 그 항목을 *"범위 밖 유지"* 로 뒀다. 마스킹 형태도 다르다
(`****<last4>` vs `***`). 여기서 건드리면 그 항목의 결정을 우회하는 셈이다 — 대신 이번
실측(접두 계열 누출)을 그 항목에 **증거로 덧붙인다**.

### 자매 표가 놓친 축 — impl-prep 이 잡았다

위 표는 *"마스킹 목록"* 만 셌고 **공용 패턴을 보충하는 다운스트림**을 안 셌다.
`13_31_57` cross_spec W1 이 `mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS` 를 지목했다 —
그 배열은 **오직** bare `token=` 하나를 담고 있어 이번 확장으로 완전히 잉여가 된다.

무수정 프로브로 동치 확인: `?token=abc&foo=bar` 가 공용만으로도 `?***&foo=bar`. 그래서
2026-07-10 URL-userinfo 흡수와 **같은 절차**로 흡수하고 `11-mcp-client.md` §8.3·Rationale 을
동기화했다. 배열은 비우되 **훅은 남긴다** — MCP 서버는 제3자 구현이라 공용이 모르는 형태를
되돌려줄 수 있고, 그때 한 줄 얹는 편이 공용 SoT 를 MCP 사정으로 넓히는 것보다 안전하다.

### 왜 "연결 문자열" 항목과 묶지 않았나 — 트래커 전제가 반증됐다

트래커는 *"패턴을 넓히면 `redact-stored-error.spec.ts` 캐너리가 RED 로 바뀌니 함께 처리하는
것이 자연스럽다"* 고 적었다. **거짓이다** — 그 캐너리는 연결 문자열을 고정하며 `token`
문자열이 한 건도 없다. 확장 후 백엔드 **427 suites / 8,811 전원 GREEN**(깨진 기존 테스트
0건)이라 묶을 이유가 사라졌다. 연결 문자열은 자체 결정(어디까지 내부 호스트명으로 볼
것인가)이 남아 있어 별건으로 둔다.

## 설계 — 접두 선택 형태

```
(?:[A-Za-z0-9]+[_-]?)?token
```

`\b` 앵커 + `i` 플래그로 `token` · `access_token` · `csrf-token` · `csrfToken` 을 모두 덮는다.
기존의 `access[_-]token|refresh[_-]token|id[_-]token` 세 대안은 이 형태에 **흡수**되므로
합친다 — 중복 대안을 남기면 다음 사람이 어느 쪽을 고쳐야 할지 갈린다.

**받아들이는 오탐**: `token: expired` 같은 산문도 `***` 가 된다. 이미 `secret:` · `password:`
가 같은 성질이라 **새로 도입하는 트레이드오프가 아니라 기존 정책의 일관 적용**이다. 마스킹은
egress 전용(DB 는 원문)이라 다운스트림 실행에는 영향이 없고, 프리필 왕복은 #1181 의 마커
가드가 막는다.

## 곁들이는 저비용 문서 3건 (전부 전제 실측 완료)

- [ ] **`hmacAlgorithm` 현재형 인용** — `14-…api.md:64`(EIA-NX-03)·`:1318`(R12)이 *"trigger
      config 에 보관하되"* 라 쓰는데, **실측**: `triggers.service.ts:634` 가 저장 시 스트립하고
      `V066` 마이그레이션이 컬럼을 제거했다. 현행 소유자는 `AuthConfig.config.algorithm`.
      결론(inbound `sha256` vs outbound `hmac-sha256` prefix 분리)은 유지하고 **출처만** 정정
- [ ] **§11 표의 `execution.stop` 행** — `:300` 표는 *"(WS 명령은 §4.2 won't-do — REST cancel
      로 처리)"* 를 달았는데 `:1124` 표는 안 달았다. 같은 문서 두 "권위 표" 가 어긋난다
- [ ] **`2-api-convention.md §2.2`** — `/api/external/*` 가 §6 rate-limit 표(`:228`·`:229`)와
      §5.4(`:440`)에는 나오는데 **URL 구조 규칙 자체**에는 없다. 별도 인증 family 임을 명시

## 작업 체크리스트

- [x] `/consistency-check --impl-prep` (`13_31_57`) — **BLOCK: NO**, CRITICAL 0 · WARNING 4
      (3건은 이 plan 이 이미 계획한 문서 정정, 1건은 아래 MCP 신규 발견)
- [x] #1 값-패턴에 `token` 계열 추가 (기존 `access`/`refresh`/`id` 3대안 흡수)
- [x] #2·#3 키-패턴에 접두 계열 추가 + 미러 주석 동기화
- [x] **impl-prep W1** — `mcp-error-codes.ts` 의 bare-token 대안 흡수 + `11-mcp-client.md`
      §8.3·Rationale 동기화. `mcp-error-codes.spec.ts` **8건 그대로 GREEN**(공용만으로)
- [x] 회귀 테스트 **19건** — 값 축 8 · 키 축 8 · 따옴표/쿼리스트링 1 · 오탐 경계 캐너리 2.
      **뮤테이션 검증**: 값-축 되돌리면 **6 RED**, 키-축 되돌리면 **8 RED** — 두 축이 각각
      독립으로 관측된다(한 축만 고쳐도 다른 축이 잡힌다)
- [x] blast radius 실측 — 백엔드 **427 suites / 8,811 전원 GREEN**. 트래커가 경고한
      캐너리 RED 는 **일어나지 않았다**(그 캐너리는 연결 문자열용)
- [x] ReDoS 벤치마크 — 2배씩 늘려 배율 **정확히 2배(선형)**. 단일 `*` + 리터럴이라 중첩 정량자 없음
- [x] 트래커: `token=` 항목 + 저비용 3건 체크박스 종결(반증된 전제 명기) ·
      workflow-assistant 항목에 접두 계열 누출 증거 추가
- [x] 저비용 문서 3건 (`hmacAlgorithm` 출처 · §11 won't-do 주석 · §2.2 인증 family)
- [ ] TEST WORKFLOW 4단계
- [ ] 코드 동결 → `/ai-review` → `--impl-done` → push
