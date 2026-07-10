# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 실제 diff 범위 (`git diff origin/main...HEAD`):
  - `codebase/backend/src/shared/utils/sanitize-error-message.ts` (+`.spec.ts`) — 공용 `SECRET_LEAK_PATTERNS`에 scheme-preserving URI-userinfo 패턴 통합
  - `codebase/backend/src/modules/mcp/mcp-error-codes.ts` (+`.spec.ts`) — MCP 전용 URL-userinfo 중복 패턴 제거
  - `spec/5-system/11-mcp-client.md` §8.3 — 위 코드 변경 반영 spec-sync
  - `review/code/2026/07/10/{10_54_39,11_04_04}/**` — 선행 `/ai-review` 산출물(이미 완료)

## 발견사항

검토 결과 정식 규약(`spec/conventions/**`) 직접 위반 사항은 발견되지 않았다. 아래는 확인만 하고 넘어간 항목과 사소한 관찰 사항이다.

- **[INFO]** `sanitize-error-message.ts` 가 두 spec 문서에서 텍스트로 참조되지만 frontmatter `code:` 미등재 (diff 무관 선재)
  - target 위치: `spec/5-system/11-mcp-client.md` frontmatter `code:` (L3-9), `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (L5-13)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §R-1/§R-6 — `status: partial` spec 의 `code:` 는 "spec 이 약속한 구현 surface" 를 커버해야 한다는 원칙
  - 상세: 두 문서 모두 본문에서 `shared/utils/sanitize-error-message.ts`(`SECRET_LEAK_PATTERNS`/`redactSecrets`/`deepRedactSecrets`)를 SoT 로 명시 인용하지만, 어느 frontmatter `code:` 글로브에도 이 경로가 없다. 다만 이는 **이번 diff 가 만든 gap 이 아니라 diff 이전부터 존재하던 상태**이며 (두 문서 모두 이번 diff 에서 이 파일을 신규로 참조하기 시작한 게 아니라 기존 참조를 갱신한 것뿐), `spec-code-paths.test.ts` 가드는 "glob 이 ≥1 개 파일에 매치" 만 검증하므로 각 문서의 기존 `code:` 글로브(`modules/mcp/**`, `modules/external-interaction/**` 등)가 이미 매치를 만족해 빌드 가드는 통과한다. Critical 로 볼 사안이 아니다.
  - 제안: 조치 불필요(이번 diff 스코프 밖). 후속 spec-sync grooming 시 `shared/utils/sanitize-error-message.ts` 를 소유하는 spec 문서(또는 신설 항목)에 명시 등재를 검토할 수 있다는 정도의 참고 사항.

## 점검 관점별 확인 내역 (위반 없음)

1. **명명 규약** — `MCP_EXTRA_SECRET_PATTERNS`, `SECRET_LEAK_PATTERNS` 등 식별자명·테스트 `describe/it` 라벨이 기존 컨벤션과 일관. 신규 API endpoint/DTO 없음.
2. **출력 포맷 규약** — 이번 diff 는 `{ code, message }` JSON envelope 구조를 변경하지 않는다. `message` 필드 **내용**(redaction 문자열 형태)만 `***host`(scheme 소실) → `scheme://***@host`(scheme 보존)로 바뀌었고, 이는 `spec/5-system/11-mcp-client.md` §8.3 표(L481)와 Rationale(L586-589)에 정확히 spec-sync 됐다 — 코드 주석(`sanitize-error-message.ts` L25-32, `mcp-error-codes.ts` L40-47/63-67)과 spec 서술이 1:1 일치함을 실측 확인.
3. **문서 구조 규약** — §8.3 표 갱신은 본문(§8), 신규 단락(`> **2026-07-10 갱신**: ...`)은 `## Rationale` 섹션의 기존 `### 에러 message redaction 은 공용 패턴 재사용 (§8.3)` 항목 말미에 정확히 배치됨 — Overview/본문/Rationale 3섹션 구조 위반 없음.
4. **API 문서 규약(OpenAPI/DTO)** — 해당 없음(diff 가 DTO/데코레이터를 건드리지 않음).
5. **금지 항목 / SoT 파편화** — 이번 diff 의 핵심 목적 자체가 "URL-userinfo 마스킹 패턴이 `mcp-error-codes.ts` 와 `sanitize-error-message.ts` 두 곳에 중복 유지되던 것을 공용 SoT 로 통합"이다. 이는 auto-memory 에 기록된 프로젝트 확립 관행("에러 메시지 토큰 마스킹은 shared/utils/sanitize-error-message.ts `SECRET_LEAK_PATTERNS` 재사용, 새로 구현 금지 — 특수 케이스만 얇게 추가")과 정확히 부합하며, `mcp-error-codes.ts` 에 남은 `MCP_EXTRA_SECRET_PATTERNS` 는 공용이 다루지 않는 bare `token=` 케이스 **한 건만** 남겨 "특수 케이스만 얇게 추가" 원칙을 그대로 지킨다. **SoT 재사용 관점에서 이 diff 는 규약을 위반하는 것이 아니라 오히려 규약을 더 강하게 준수하는 방향의 리팩터다.**
6. **node-output.md Principle 7 (URL-credential non-exposure)** — 실측 확인:
   - Principle 7 (`spec/conventions/node-output.md` L287-305)은 `NodeHandlerOutput.config` echo 전용 규약이며, 그 규약이 실제로 강제되는 코드 경로는 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 의 `sanitizeUrlCredentials()`(L69-91, `parsed.username=''; parsed.password=''`로 완전 제거 → `https://host` 클린 스트립)다. **이번 diff 는 이 함수를 전혀 건드리지 않았다** — `git diff` 에 해당 파일 없음. 따라서 Principle 7 이 규정하는 `NodeHandlerOutput.config` 표면의 URL-credential 비노출은 이번 변경으로 영향받지 않는다.
   - 이번 diff 가 건드린 `SECRET_LEAK_PATTERNS`(공용)는 다른 sink — 자유 형식 에러 메시지(`Integration.last_error`, `IntegrationUsageLog.error`, MCP 진단)와 EIA `nodeOutput`/`conversationThread` 의 defense-in-depth egress 마스킹(`deepRedactSecrets`, `spec/5-system/14-external-interaction-api.md` R17)에 쓰인다. 새 정규식 `(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)` 은 `user:pass` 자격증명 **전체**(콜론 포함 비밀번호까지)를 lookbehind/lookahead 로 정확히 캡처해 `***` 로 치환하므로 — username 도 password 도 부분 노출 없이 완전히 마스킹됨을 신규 테스트(`sanitize-error-message.spec.ts` "masks a password containing an embedded colon")로 확인. scheme(`https`/`redis`/`amqp` 등)만 보존되고 credential 은 완전 제거되므로 **"URL-credential non-exposure" 라는 Principle 7 의 실질 목표(자격증명 미노출)를 이 sink 에서도 동일하게 충족**한다. scheme 보존 자체는 Principle 7 예시(`https://user:pass@host → https://host`)도 scheme 을 보존하므로 상충하지 않는다.
   - 선행 `/ai-review`(security reviewer, `review/code/2026/07/10/10_54_39/SUMMARY.md` #3)가 "scheme 이 비-MCP 소비처에 신규 노출"을 이미 검토해 "credential 아님, 의도된 tradeoff·문서화"로 조치 불필요 처분했고 spec §8.3 에도 반영됐다 — 중복 처분 불필요.

## 요약

이번 diff(`origin/main...HEAD`)는 URL-userinfo 시크릿 마스킹 패턴을 MCP 모듈 전용 중복 구현에서 공용 SoT(`shared/utils/sanitize-error-message.ts SECRET_LEAK_PATTERNS`)로 통합한 소규모 리팩터이며, 정식 규약 관점에서 위반 사항이 없다. SoT 재사용은 프로젝트가 확립한 규약(중복 방지)을 정확히 따르고, `node-output.md` Principle 7 이 규정하는 `NodeHandlerOutput.config` 의 URL-credential 비노출은 이번 diff 가 건드리지 않은 별도 함수(`sanitizeUrlCredentials`)가 그대로 담당하므로 영향이 없으며, 이번 diff 가 담당하는 별도 sink(에러 메시지·EIA nodeOutput)에서도 자격증명은 완전히 마스킹되어(`scheme://***@host`, scheme 만 보존) 동일한 비노출 목표를 충족한다. `spec/5-system/11-mcp-client.md` §8.3 은 코드 변경과 1:1 로 정확히 동기화됐고 문서 구조(본문/Rationale 배치)도 기존 컨벤션을 지킨다. 유일한 관찰 사항(공용 유틸의 frontmatter `code:` 미등재)은 diff 이전부터 있던 사소한 상태로 Critical/Warning 대상이 아니다.

## 위험도

NONE
