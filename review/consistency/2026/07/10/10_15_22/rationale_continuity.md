# Rationale 연속성 검토 — SECRET_LEAK_PATTERNS 확장 (bare JWT + URI userinfo)

## 검증 방법

`git diff origin/main...HEAD` 로 실 diff 확인 — 유일한 실질 코드 변경은
`codebase/backend/src/shared/utils/sanitize-error-message.ts`(+ 대응 spec 파일)에
`SECRET_LEAK_PATTERNS` 배열 2개 정규식(bare JWT, URI-embedded userinfo) 추가.
prompt payload 에 embed 된 target(`spec/5-system/1-auth.md`, `10-graph-rag.md`)은
실 diff 와 무관한 내용이라(둘 다 `code:` frontmatter 가 이 파일을 가리키지 않음)
참고하지 않고, 실제로 이 SoT 를 규율하는 Rationale 소스를 직접 추적했다:

- `spec/5-system/14-external-interaction-api.md` §R17 (전체, 특히 "표면 제약(보안)" 절)
- `spec/5-system/11-mcp-client.md` §8.2 표 + 587행 Rationale ("MCP 전용 추가 마스킹 패턴")
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` (`MCP_EXTRA_SECRET_PATTERNS`)
- `plan/complete/eia-secret-masking-residuals.md` (선행 R17 잔여 하드닝 plan, 이미 완료·이동됨)
- `review/code/2026/07/10/{10_05_20,10_14_41}/*.md` (본 diff 에 대한 선행 ai-review)
- `git log`(해당 파일 히스토리) — 과거 기각된 대안 유무 확인

## 발견사항

- **[INFO]** `spec/5-system/11-mcp-client.md` Rationale(587행)의 "MCP 특화 케이스" 서술이
  이번 확장으로 부분적으로 낡음(stale) — 기능 충돌은 아님
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:44-46`
    (`SECRET_LEAK_PATTERNS` 신규 URI-userinfo 정규식)
  - 과거 결정 출처: `spec/5-system/11-mcp-client.md:587` — "공용 `SECRET_LEAK_PATTERNS` 를
    재사용하고, **그것이 다루지 않는** MCP 특화 케이스(connect URL userinfo·쿼리 bare
    token)만 얇게 얹는다" (PR #842, `mcp-error-codes.ts` `MCP_EXTRA_SECRET_PATTERNS`).
  - 상세: 이 Rationale 은 "URL userinfo 마스킹은 공용 SoT 가 커버하지 않는 MCP 고유 gap"
    이라는 전제 위에 서 있었다. 이번 diff 가 공용 `SECRET_LEAK_PATTERNS` 에 **모든 스킴에
    대한** URI-userinfo 패턴(`\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@`)을 추가하면서
    그 전제가 절반 깨졌다 — `MCP_EXTRA_SECRET_PATTERNS` 의 URL-userinfo 항목(라인 48)이
    이제 공용 패턴과 사실상 중복이다(둘 다 임의 스킴의 `user:pass@` 를 마스킹). 실행 순서상
    `redactMcpSecrets` 가 MCP 전용 패턴을 먼저 적용해 `scheme://***@` 로 치환한 뒤 공용
    패턴을 돌리므로 **런타임 충돌·이중 마스킹은 없음**을 직접 추적해 확인했다(`redactMcpSecrets`
    는 `MCP_EXTRA_SECRET_PATTERNS` 순회 후 `SECRET_LEAK_PATTERNS` 순회 — 이미 `***@` 로
    바뀐 문자열엔 `user:pass@` 형태가 남지 않아 재매치되지 않음). `RESOLUTION.md`
    (`review/code/2026/07/10/10_14_41/RESOLUTION.md`)도 "MCP net-new 는 bare-JWT
    한정(자체 userinfo 패턴 PR #842 선행)"이라 명시해 이 중복을 인지한 상태로 스코프를
    의도적으로 좁힌 것으로 보인다 — 즉 **묵시적 인지 후 의도적 최소-diff 선택**이라 결함은
    아니다. 다만 `11-mcp-client.md` Rationale 문면은 여전히 "공용이 다루지 않는 케이스"라는
    옛 전제를 그대로 서술하고 있어, 이 diff 이후 시점 기준으로는 부정확하다(현재 유효한
    MCP 고유 gap 은 "쿼리 bare token" 뿐).
  - 제안: 다음 중 하나. (a) `mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS` 에서
    이제 중복된 URI-userinfo 항목(48행)을 제거하고 bare-token 항목만 남긴 뒤
    `11-mcp-client.md:587` 문구를 "쿼리 bare token만 MCP 고유"로 갱신, 또는 (b) 중복을
    "이중 방어(defense-in-depth)로 의도적 유지"라고 판단한다면 `11-mcp-client.md:587`
    Rationale 문구를 "공용이 URL-userinfo 를 이미 커버하나 방어 심도를 위해 MCP 레이어에도
    유지" 로 정정해 문서-코드 스코프 서술을 실제와 맞춘다. 어느 쪽이든 코드 동작은
    바꿀 필요 없음(이미 안전) — 문서 정합만의 문제.

## 요약

이번 diff(`shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS` 에 bare JWT +
URI-userinfo 패턴 2개 추가)는 Rationale 연속성 관점에서 매우 견고하다. (1) EIA
`14-external-interaction-api.md` §R17 이 "모든 마스킹은 `SECRET_LEAK_PATTERNS`/
`CREDENTIAL_KEY_PATTERN`(에러 메시지 sanitizer 와 동일 SoT)을 재사용한다"고 명시적으로
못박은 원칙을 정확히 따라 — 새 위치에 마스킹 로직을 재구현하지 않고 기존 SoT 배열 자체를
확장했다(사용자 memory rule `reference_shared_secret_redaction_sot` 와도 일치). (2) 과거
spec/git history 어디에도 "bare JWT" 또는 "URI userinfo" 탐지를 명시적으로 기각한 기록이
없어 기각된 대안의 재도입에 해당하지 않는다. (3) R17 이 이미 확정한 "egress-only(저장 시점
redaction 은 보류, P1-3)"·"전 표면 마스킹 + rare FP 수용(P1-1, 현행 유지 결정)" 두 경계를
그대로 보존한다 — 이번 패턴 확장이 닿는 소비처(`ai-turn-orchestrator`·`thread-renderer`·
`interaction.service` 등)는 모두 기존에 이미 egress 마스킹을 적용하던 지점이며, 저장
경로(durable `conversation_thread` 컬럼, LLM 컨텍스트 주입)는 건드리지 않는다. 선행
ai-review(`review/code/2026/07/10/10_05_20`, `10_14_41`) 가 ReDoS·FP·소비처 회귀를 실측
검증해 CRITICAL/WARNING 없음(NONE→LOW)으로 마무리했고, 그 과정에서 발견된 MCP 모듈과의
패턴 중복 가능성도 인지된 채로 최소 diff 를 선택한 흔적이 `RESOLUTION.md` 에 남아있다.
유일한 잔여 사항은 `spec/5-system/11-mcp-client.md` Rationale 의 "공용이 다루지 않는
케이스만 MCP 가 보완한다"는 문구가 이번 확장으로 절반(URI-userinfo) 낡아졌다는 문서
정합 이슈이며, 런타임 동작·보안에는 영향이 없다.

## 위험도

LOW
