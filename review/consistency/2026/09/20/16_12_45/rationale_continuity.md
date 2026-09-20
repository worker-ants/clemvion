# Rationale 연속성 검토 — spec-draft-integration-error-facts.md

## 발견사항

- **[INFO]** §8.3(2026-07-05)·`DB_HOST_BLOCKED` Rationale(2026-06-12)이 "판정 vs 가드의 고장" 구분을 모르던 시절 문장이라, 신규 추가문과 나란히 읽으면 번복처럼 보일 여지
  - target 위치: 변경안 ②, `1-http-request.md §4 step 8/9` 신설 문장, `2-database-query.md §6.2` `INTEGRATION_*` 행 추가 구
  - 과거 결정 출처:
    - `spec/4-nodes/4-integration/1-http-request.md` `## 8. Rationale` → `### 8.3 SSRF 차단 메시지 일반화 — 정찰 면 축소 (2026-07-05)`: "함께 **redirect 대상·한도 초과 SSRF 차단도 `HTTP_BLOCKED` 로 라우팅한다** — 종전 redirect hop 의 SSRF 예외가 바깥 일반 catch 로 떨어져 오분류(`HTTP_TRANSPORT_FAILED`/`INTEGRATION_CALL_FAILED`)되던 것을 … 정정."
    - `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` → `### DB_HOST_BLOCKED 전용 SSRF 차단 코드 신설 (2026-06-12)`: "종전에는 DB host SSRF 차단이 공용 가드의 plain `Error` 로 throw 돼 `mapDbError` fallback 인 generic `INTEGRATION_CALL_FAILED` 로 surface 됐다" (비대칭 문제로 규정하고 `DB_HOST_BLOCKED` 신설로 고침).
  - 상세: 두 Rationale 모두 "SSRF 관련 예외가 `HTTP_TRANSPORT_FAILED`/`INTEGRATION_CALL_FAILED` 같은 일반 코드로 새는 것"을 **과거의 결함**으로 규정하고 고쳤다. 그런데 target 이 이번에 §4 step 9 에 추가하는 문장("리다이렉트 홉에서 같은 고장이 나면 전송 catch 로 떨어져 `HTTP_TRANSPORT_FAILED` 가 된다")과 `2-database-query.md §6.2` 에 추가하는 구("SSRF 가드가 판정 아닌 오류를 던진 경우" → `INTEGRATION_CALL_FAILED`)는 **표면적으로 그 결함과 같은 코드 조합**을 다시 등장시킨다. 실제로는 대상이 다르다 — 옛 결함은 **차단 판정(`SsrfBlockedError`) 자체**가 새던 것이고, 이번 추가는 **가드 자체의 고장(비판정)** 만을 가리킨다(근거: `plan/complete/ssrf-catch-instanceof.md` #1364 의 "호출부마다 정한 기대 동작" 표 — `SsrfBlockedError` 열은 그대로, "그 밖" 열만 일반 코드로 승격). target 의 문장 자체는 "차단 판정이 아니면(가드 자체의 고장)" 이라는 한정어로 이 구분을 명시하고 있어 **내용상 모순은 없다**. 다만 §8.3·`DB_HOST_BLOCKED` Rationale 은 이 "판정/고장" 어휘가 생기기 전에 쓰인 글이라 자체적으로는 그 구분을 갖고 있지 않다 — 두 시점의 텍스트만 따로 읽는 다음 사람이 "리다이렉트 SSRF 관련 실패가 다시 `HTTP_TRANSPORT_FAILED` 로 새는 옛 버그가 재발했다"고 오독할 위험이 남는다.
  - 제안: 두 신규 문장에 이미 있는 "차단 판정이 아니면" 한정을 유지하는 것으로 실질적 위험은 낮지만, spec 반영 시 §8.3 또는 신설 문장 쪽에 **한 구만** 덧붙여 명시적으로 연결하면 다음 사람의 재확인 비용을 없앨 수 있다 — 예: "(§8.3 의 «redirect SSRF 차단→`HTTP_BLOCKED`» 은 판정에 한정되며, 가드 자체의 고장은 본 항목이 다룬다)". 강제 사항은 아니며, target 의 현재 문구만으로도 논리적 모순은 없다.

## 요약

target 이 다루는 네 정정 중 셋(①③④)은 기존 Rationale 의 어떤 결정도 재검토·번복하지 않는 순수 사실 보강(코드 목록·어휘 표 추가, 자기모순 문장 교체)이며, ④는 오히려 §5.9 첫 문단이 이미 암시하던("공유 메커니즘" 목록에 403 처리가 빠져 있던) 구분을 본문과 일치시키는 보정이다. 가장 위험도가 높았던 ②(SSRF "가드의 고장" 트리거)는 이미 1차 `--spec` 검토(CRITICAL)에서 "열린 결정(홉/preflight 코드 통일 여부)을 선취"하는 문제로 반려된 뒤, 실측표로 두 시점을 분리하고 통일 여부는 트래커의 열린 항목으로 명시적으로 남겨 재작성됐다 — 이는 본 checker 가 우려하는 "기각된 대안의 재도입"이나 "무근거 번복"에 해당하지 않는다. `0-common.md §4.2`(`INTEGRATION_CALL_FAILED` = 분류 안 된 예외의 fallback), `1-http-request.md §8.2/§8.3`(SSRF 가드 전 인증 공통·메시지 일반화), `2-database-query.md`(`DB_HOST_BLOCKED` 전용 코드 신설) 등 관련 Rationale 의 원칙과도 배치되지 않으며, 오히려 "차단 코드는 판정에만 쓴다"는 §8.3 의 정신을 "가드 자체의 고장"이라는 새 축으로 명시적으로 연장한다. 유일하게 남는 리스크는 CRITICAL/WARNING 급이 아니라, 옛 Rationale(§8.3·`DB_HOST_BLOCKED`)이 "판정/고장" 구분이 생기기 전 문장이라 신규 문구와 나란히 읽을 때 오독 여지가 있다는 문서 가독성 수준의 INFO 다.

## 위험도

LOW
