# Cross-Spec 일관성 검토 — `spec/5-system/` (`eia-secret-pattern-token-family`)

## 발견사항

### [WARNING] `SECRET_LEAK_PATTERNS` 의 bare `token=` 흡수가 `11-mcp-client.md` 의 "MCP 전용 잔여" 서술을 무효화 — 자매 소비자 누락

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R17 (`shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 를 EIA egress 마스킹 SoT 로 지목하는 대목). 실제 변경은 이미 워킹 트리에 반영됨 — `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`SECRET_LEAK_PATTERNS`[1]에 `[A-Za-z0-9_-]*token` 대안 추가) + `codebase/backend/src/modules/websocket/websocket.service.ts`(`CREDENTIAL_KEY_PATTERN` 동형 확장).
- **충돌 대상**: `spec/5-system/11-mcp-client.md` §8.3 (line 485) + Rationale "에러 message redaction 은 공용 패턴 재사용" (line 603–606), 그리고 그 서술이 가리키는 `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS`.
- **상세**: `11-mcp-client.md:485`는 "공용 `SECRET_LEAK_PATTERNS` + **MCP 전용 bare-token(`token=`) 패턴**"이라고 명시하고, 같은 문서 §Rationale(604줄)은 "공용이 다루지 않는 MCP 특화 케이스(쿼리 bare `token=`)만 얇게 얹는다", 606줄은 "MCP 전용으로 남는 것은 bare `token=` 뿐이다"라고 못박는다. `mcp-error-codes.ts`의 `MCP_EXTRA_SECRET_PATTERNS`(`/(\btoken\s*[=:]\s*)[^&\s;'"]+/gi`)가 바로 그 잔여를 메우는 보충 패턴이며, 본 파일 자체의 JSDoc(45–47줄)이 "2026-07-10, URL-userinfo 패턴은 공용이 흡수해 MCP 전용 목록에서 제거했다"는 **동일 클래스의 선례**를 이미 기록해 두고 있다.
  이번 변경으로 공용 `SECRET_LEAK_PATTERNS`의 `[A-Za-z0-9_-]*token` 대안은 `[A-Za-z0-9_-]*`가 0글자도 매칭하므로 bare `token=`/`token:`를 **이미 포함**한다 — `MCP_EXTRA_SECRET_PATTERNS`와 기능적으로 완전히 중복된다. 즉 이 PR이 그대로 나가면: (1) `mcp-error-codes.ts`에 죽은/중복 정규식이 남고, (2) `11-mcp-client.md`가 "MCP 전용으로 남는 것은 bare `token=` 뿐"이라는 **이제 거짓인 주장**을 계속한다 — 이 저장소가 반복해 경계해 온 "파편화된 secret-pattern SoT" 상태로 회귀한다.
  plan(`eia-secret-pattern-token-family.md`)의 "자매 전수" 표는 마스킹 목록 **넷**만 세었고(`SECRET_LEAK_PATTERNS`·`CREDENTIAL_KEY_PATTERN`×2·`DEFAULT_SENSITIVE_KEYS`), `SECRET_LEAK_PATTERNS`를 **소비하며 그 위에 보충 패턴을 얹는** `mcp-error-codes.ts`는 그 표에 없다 — 다른 축(공용 패턴을 얹어 쓰는 다운스트림)이라 표에서 빠졌다.
- **제안**: 이번 PR 범위에 (a) `mcp-error-codes.ts`의 `MCP_EXTRA_SECRET_PATTERNS`(bare-token 대안) 제거 — 이미 §11-mcp-client.md 606줄이 보여준 "공용 흡수 시 MCP 전용 목록에서 제거" 선례를 그대로 따르면 됨, (b) `spec/5-system/11-mcp-client.md` §8.3(485줄)과 §Rationale(603–606줄)을 갱신해 "MCP 전용 bare-token 패턴"이 이제 공용에 흡수됐음을 2026-07-10 URL-userinfo 사례와 같은 형식으로 기록. 회귀 테스트는 `mcp-error-codes.spec.ts`의 bare-token 케이스가 공용 패턴만으로도 여전히 RED→GREEN 되는지 확인.

### [WARNING] EIA-NX-03/§R12 의 `hmacAlgorithm` "trigger config 보관" 서술이 `12-webhook.md`와 상충 (plan 항목 1, 실측 확인됨)

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.1 EIA-NX-03 (line 64: "...동일 값을 trigger config 에 보관하되 (`hmacAlgorithm: 'sha256'`)...") + §9.3 R12 (line 1318, 1322).
- **충돌 대상**: `spec/5-system/12-webhook.md` line 167 — "인증 키는 `config` 에 보유하지 않는다... 과거 inline 키(`authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm`)는 `V066__trigger_config_strip_inline_auth.sql` cleanup migration 으로 제거되며... `AuthConfig.config`의 `header`/`algorithm`은... 트리거가 아니라 자격증명 메타."
- **상세**: 같은 `14-external-interaction-api.md` 문서 내 §7.1 근처(line 896 부근)는 이미 "옛 inline auth 필드(`hmacAlgorithm` 포함)는 폐지됐고 V066 cleanup migration 으로 제거된다"고 정확히 적어 두었으나, §3.1(EIA-NX-03)과 §9.3(R12)은 여전히 구식 서술("trigger config 에 보관")을 유지한다 — 즉 자기 문서 안에서도 갈리며, `12-webhook.md`의 SoT 서술과는 직접 모순이다. `1-data-model.md`는 이 필드를 별도로 언급하지 않아 3중 동기화 대상은 아님(확인함).
- **제안**: plan의 doc-fix 항목 그대로 진행 — EIA-NX-03·R12의 "trigger config 보관" 표현을 "`AuthConfig.config.algorithm`" 소유로 정정하고 12-webhook.md:167 을 출처로 링크.

### [WARNING] EIA §11 `execution.stop` 매핑 행이 권위 표(WS §4.6)의 won't-do 주석을 누락 (plan 항목 2, 실측 확인됨)

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §11 (line 1124: `| \`execution.stop\` | \`cancel\` | \`force\` 옵션은 외부에서 미지원 |`).
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.6 "외부 표면 매핑" (line 807–823) — 이 표는 자신을 명시적으로 **권위 표**로 선언한다("두 표면의 의미가 분기되지 않도록 본 §4.6 의 매핑 표가 권위적이며, 외부 spec 의 §11 표는 이 표와 정합해야 한다", line 809). 그 권위 표의 동일 행(line 820)은 `` `execution.stop` _(WS 명령 §4.2 won't-do)_ `` 로 annotation 을 명시한다.
- **상세**: 같은 문서(EIA) §5.1 지원 명령 표(line 300)는 "`execution.stop` 은 §4.2 에서 비채택(won't-do)"이라고 annotation 을 이미 달아 두었는데, §11 표만 이를 빠뜨렸다 — §11 도입부가 "§5.1 의 표가 권위 표와 정합해야 한다"고 §5.1 만 지목한 것도 실수의 일부로 보인다(실제로 §11 자체가 WS §4.6 과 1:1 대응하는 표). 기능적 의미는 §11 다음 행의 텍스트("`force` 옵션은 외부에서 미지원")로 유추 가능해 오독 위험은 낮지만, 세 표(EIA §5.1 / EIA §11 / WS §4.6) 가 스스로 "정합 의무"를 선언해 둔 상태에서 하나만 어긋나 있다.
- **제안**: plan 항목 2 그대로 진행 — §11 행에 `` _(WS 명령 §4.2 won't-do)_ `` 주석을 추가해 §5.1·WS §4.6 과 표기를 통일. 세 표 모두 같은 PR 에서 함께 확인.

### [INFO] `2-api-convention.md` §2 URL 구조 규칙에 `/api/external/*` 예외 미기재 (plan 항목 3, 실측 확인됨)

- **target 위치**: `spec/5-system/2-api-convention.md` §2.1/§2.2 (line 63–81) — 기본 패턴 `{base_url}/api/{resource}` 및 RPC sub-channel 예외만 나열.
- **충돌 대상**: 같은 문서 §6 rate-limit 표(line 228–229)·§5.4(line 440)는 `/api/external/executions/:id/...` 를 이미 전제로 서술하고, `14-external-interaction-api.md` §8 은 별도 Bearer scheme(`interaction-token`, `iext_*`/`itk_*`)로 인증되는 완전히 다른 URL 네임스페이스(`/api/external/*`)임을 규정한다.
- **상세**: `/api/external/*` 는 `{base_url}/api/{resource}` 패턴을 따르지 않고(리소스가 `executions` 지만 앞에 `external` 세그먼트가 끼어들며, 워크스페이스 JWT 가 아니라 별도 토큰 family 를 씀) §2 자체에는 이 예외가 등재돼 있지 않다 — RPC sub-channel 예외(§2.2)와 같은 층위의 별도 URL-family 예외가 필요하다.
- **제안**: plan 항목 3 그대로 진행 — §2.2 예외 목록 옆(혹은 별도 행)에 `/api/external/{resource}` 를 "별도 인증 family(interaction-token) 전용 네임스페이스" 로 명문화.

## 요약

target(`spec/5-system/`)에 대한 이번 impl-prep 은 plan 이 스스로 지목한 저비용 문서 정정 3건(hmacAlgorithm 출처, §11 execution.stop 주석, `/api/external/*` URL 예외) 을 모두 실측으로 재확인했으며 셋 다 실제로 다른 spec 영역(§12-webhook, §6-websocket-protocol, 자기 문서 §6)과 상충하거나 누락돼 있어 plan 대로 진행하는 것이 타당하다. 다만 plan 의 "자매 전수" 조사가 놓친 항목이 하나 있다 — 이미 코드에 반영된 `SECRET_LEAK_PATTERNS` bare `token=` 확장이 `spec/5-system/11-mcp-client.md` 가 명시적으로 기술해 둔 "MCP 전용 잔여 bare-token 패턴" 서술과 그 구현체(`mcp-error-codes.ts` `MCP_EXTRA_SECRET_PATTERNS`)를 지금 당장 중복/구식으로 만든다. 이 저장소는 정확히 같은 클래스의 흡수(URL-userinfo, 2026-07-10)를 이미 한 번 겪었고 그때 남긴 절차(공용 흡수 → MCP 전용 목록에서 제거 → spec 갱신)가 이번에도 그대로 적용 가능하므로, 이번 PR 범위에 포함시켜 함께 닫는 것을 권장한다. 나머지 세 항목은 기능적 파손이 아닌 문서 동기화 성격이라 WARNING/INFO 수준이다.

## 위험도

MEDIUM
