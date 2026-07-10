# 정식 규약 준수 검토 — SECRET_LEAK_PATTERNS 확장

## 사전 참고: 입력 payload 와 실제 diff 의 불일치

`_prompts/convention_compliance.md` 에 담긴 "Target 문서"(`spec/5-system/1-auth.md`·`2-api-convention.md`·
knowledge-base·`audit-actions.md`·`api-catalog.md` 전문)는 이번 브랜치의 실제 변경분과 무관한 내용이었다
(별도 태스크용으로 작성된 payload 가 잘못 재사용된 것으로 보임 — 파일 안에 `## 구현 변경 사항` 섹션이
언급만 되고 실제로 존재하지 않음). 사용자 지시에 따라 실제 diff 를 직접 확인해 검토를 재정렬했다:

```
git diff origin/main...HEAD --stat
 codebase/backend/src/shared/utils/sanitize-error-message.spec.ts | 48 +++++++
 codebase/backend/src/shared/utils/sanitize-error-message.ts      | 15 ++-
 review/code/2026/07/10/10_05_20/**                                (선행 코드리뷰 산출물)
 review/code/2026/07/10/10_14_41/**                                (선행 코드리뷰 산출물)
```

실질 변경은 `SECRET_LEAK_PATTERNS`(공용 SoT, `codebase/backend/src/shared/utils/sanitize-error-message.ts`)에
정규식 2개(bare JWT, 임의 scheme URI-userinfo credential)를 추가한 순수 additive 확장 + 대응 테스트뿐이다.
이하는 이 실제 diff 를 대상으로 한 정식 규약(`spec/conventions/**`) 준수 검토다.

---

## 발견사항

- **[INFO] Orchestrator 프롬프트 payload 재사용 오류 (검토 대상 아님)**
  - target 위치: `_prompts/convention_compliance.md` 전체
  - 위반 규약: 해당 없음 (target 문서 자체가 아니라 checker 입력 payload 의 문제)
  - 상세: payload 가 `spec/5-system/` 인증·시스템 spec 전문을 "Target 문서"로 실었으나, 실제 검토해야 할
    변경분(diff)은 어디에도 포함되지 않았다(`## 구현 변경 사항` 헤더만 언급되고 본문 부재). 이 상태로 그대로
    분석했다면 무관한 spec 전문에 대해 규약 위반을 찾는 헛수고 내지 false negative(진짜 diff 미검토)로 이어졌을
    것이다.
  - 제안: 이번 건은 사용자가 실제 diff 를 직접 지정해 우회했으나, orchestrator 쪽에서 `--impl-done` 모드의
    prompt-builder 가 diff-base 산출 단계에서 실패했을 때 stale/mismatched payload 를 그대로 흘려보내지 않도록
    가드(예: `## 구현 변경 사항` 섹션 부재 시 fail-fast)를 추가하는 편이 안전하다.

- **[INFO] 신규 URI-userinfo 패턴은 scheme 까지 통째로 `***` 치환 — 목적이 다른 인접 컨벤션과 표기 스타일 차이**
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:44-46` (`SECRET_LEAK_PATTERNS` 마지막 원소)
  - 위반 규약: 직접 위반 아님 — 참고 규약은 [`spec/conventions/node-output.md` Principle 7](../../../../../spec/conventions/node-output.md) "절대 echo 금지" 절의 "URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize)"
  - 상세: node-output.md 는 **`NodeHandlerOutput.config` echo** 문맥에서 URL credential 을 `scheme://host` 형태로 보존
    sanitize 하라고 규정한다. 신규 공용 패턴은 `scheme://user:pass@` 구간 **전체**(scheme 포함)를 `***` 로 치환하므로
    `https://admin:pw@host/path` → `***host/path` 가 되어 scheme 정보가 사라진다(직접 확인: `redactSecrets('connect
    https://admin:supersecret@internal.example.com/path failed')` → `'connect ***internal.example.com/path failed'`).
    다만 이 두 코드 경로는 서로 다른 계층이다 — node-output.md Principle 7 이 규정하는 대상은 실제로
    `http-request.handler.ts` 의 전용 `sanitizeUrlCredentials()`(scheme 보존)가 구현하고 있고, 이번에 확장된
    `SECRET_LEAK_PATTERNS`/`redactSecrets` 는 자유 텍스트 에러 메시지 마스킹(EIA conversation-thread egress, MCP
    에러, 실행 엔진 알림 등)이 대상이라 node-output.md 의 적용 범위 밖이다. 따라서 **규약 위반은 아니며**, 두 계층이
    다른 출력 포맷(하나는 scheme 보존, 하나는 통째 마스킹)을 쓴다는 사실만 기록해 둔다.
  - 제안: 조치 불필요. 다만 두 마스킹 스타일이 향후 같은 문자열에 이중 적용될 가능성(예: MCP 자체 userinfo 패턴이
    scheme 을 보존(`$1***@`)한 뒤 공용 패턴이 다시 훑는 순서)이 있으니, 새 소비처를 추가할 때는 어떤 sanitizer 를
    먼저 태울지 순서를 명시적으로 정의하는 편이 좋다(현재 `mcp-error-codes.ts`는 이미 MCP 전용 패턴 → 공용 패턴
    순서로 정의돼 있어 문제 없음).

정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다. 확인한 근거:

1. **SoT 재사용 원칙 준수**: 이번 변경은 새 sanitizer 를 만들지 않고 기존 공용 `SECRET_LEAK_PATTERNS` 배열(단일
   export)에 정규식 2개를 추가하는 형태다. `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`
   (실행 엔진), `codebase/backend/src/modules/mcp/mcp-error-codes.ts`(MCP), EIA conversation-thread egress
   (`spec/5-system/14-external-interaction-api.md` §R17)가 모두 동일 배열을 `import`/순회해 소비하므로, 확장분이
   모든 소비처에 자동 전파된다 — "새로 구현 금지, 특수 케이스만 얇게 추가" 원칙과 정확히 일치.
2. **`spec/5-system/11-mcp-client.md` §8.3·§7.1 표**와 **`spec/5-system/14-external-interaction-api.md` §R17** 이
   이미 "공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 재사용" 하는 정책을 명문화해 뒀고,
   이번 diff 는 그 SoT 자체를 보강한 것이라 두 spec 문서의 서술과 모순되지 않는다(spec 문서 자체는 이번 diff 의
   변경 대상이 아니므로 갱신 의무도 발생하지 않음 — CLAUDE.md 상 "결정의 배경·근거"에 해당할 만큼 아키텍처적인
   신규 결정이 아니라 기존에 문서화된 정책의 커버리지 확장).
3. **`spec/conventions/node-output.md`** "절대 echo 금지" 절(자격증명·URL 내 임베디드 credential)이 요구하는 보호
   범주(위 발견사항 2번째 항목)와 방향이 일치 — 오히려 이번 확장이 그 불변식을 더 강하게 뒷받침한다(자유 텍스트
   경로에서 새던 bare JWT·비-DB scheme userinfo credential 을 추가로 막음).
4. **`spec/conventions/secret-store.md`** (자격증명 *보관* 암호화 규약)은 이번 변경의 대상(에러 메시지 *마스킹*)과
   레이어가 달라 해당 사항 없음 — 충돌 없음.
5. **문서 구조·API 문서·명명 규약**: 이번 diff 는 spec 문서·DTO·API endpoint·OpenAPI 데코레이터를 전혀 건드리지
   않는다(순수 backend 유틸 + 유닛테스트). `SECRET_LEAK_PATTERNS`(UPPER_SNAKE_CASE 상수) 명명은 기존 파일의 기존
   명명 패턴을 그대로 따르며 신규 식별자 명명 문제 없음.
6. **금지 항목**: `spec/conventions/**` 전체를 스캔했을 때 정규식 사용·에러 메시지 마스킹 방식에 대한 명시적
   금지 규정은 없다(`spec/conventions/migrations.md`·`error-codes.md`·`swagger.md` 등 확인, 관련 조항 부재).

## 요약

실제 diff(`git diff origin/main...HEAD`)는 공용 secret-redaction SoT(`SECRET_LEAK_PATTERNS`,
`codebase/backend/src/shared/utils/sanitize-error-message.ts`)에 bare JWT·임의 scheme URI-userinfo credential
2개 패턴을 추가하는 순수 additive 확장이며, 이미 이 배열을 소비 중인 실행 엔진·MCP·EIA conversation-thread egress
경로 전부에 자동 전파된다. `spec/5-system/11-mcp-client.md`·`spec/5-system/14-external-interaction-api.md`(§R17)가
문서화한 "공용 패턴 재사용, 신규 sanitizer 금지" 정책과 `spec/conventions/node-output.md` 의 URL credential
비노출 불변식 모두와 방향이 일치하며, 신규 spec 문서·DTO·API 표면 변경이 없어 명명·출력 포맷·문서 구조·API
문서 규약 어느 것도 저촉하지 않는다. 유일하게 기록해 둘 점은 (a) 이번 checker 에 주어진 프롬프트 payload 가
실제 diff 와 무관한 내용이었다는 orchestrator 측 이슈(INFO, target 결함 아님), (b) 신규 URI-userinfo 패턴이
scheme 까지 포함해 통째로 마스킹해 node-output.md Principle 7 이 규정하는 (다른 계층의) `scheme://host` 보존
스타일과 표기가 다르다는 점(INFO, 규약 위반 아님·계층이 다름)뿐이다.

## 위험도

NONE
