### 발견사항

없음.

target 변경은 `spec/5-system/14-external-interaction-api.md` 의 `code:` frontmatter 1줄 추가와
Rationale(마커 SoT 서술) 재작성으로 국한된다 — 마스킹 마커(`VALUE_MASK_MARKER` /
`KEY_MASK_MARKER` / `DEPTH_MASK_MARKER` / `MASKED_MARKERS` / `isMaskedMarker` /
`MAX_MASK_DEPTH`)의 SoT 를 backend `sanitize-error-message.ts` 손 복제에서 신규 공유 패키지
`codebase/packages/masked-markers`(`@workflow/masked-markers`)로 옮기고, backend·frontend 양쪽을
재export shim 으로 전환한 리팩터다. 다음 관점을 점검했으며 전부 충돌 없음을 확인했다:

1. **데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC** — 이번 변경은 값 이름·엔티티·
   엔드포인트·요구사항 ID·상태 머신·권한 모델을 하나도 건드리지 않는다. 해당 축의 충돌 표면
   자체가 없다.

2. **계층 책임 충돌 (§6)** — `codebase/packages/**` 를 backend·frontend 공용 SoT 로 쓰는 패턴은
   이미 저장소에 6개 선례가 있다(`ai-end-reason`/`expression-engine`/`graph-warning-rules`/
   `node-summary`/`chat-channel-validation`/`sdk`). 특히 `@workflow/ai-end-reason` 은 "backend 가
   생산·frontend 가 판정"이라는 동일 형태를 이미 쓰고 있어 신규 패턴이 아니다
   (`codebase/packages/ai-end-reason/src/index.ts` 주석 확인). `spec/conventions/
   frontend-layering.md` 는 frontend 내부 `app/components/lib/types` 축만 다루고 backend↔frontend
   패키지 공유는 그 스코프 밖이라 상충하지 않는다. CI 워크플로(`frontend-checks.yml` /
   `packages-checks.yml` / `.claude/test-stages.sh`)도 기존 패키지 등록 패턴을 그대로 따라
   `@workflow/masked-markers` 를 추가했다 — 별도 SoT 문서를 요구하는 기존 규약과 충돌 없음.

3. **인접 spec 의 동일 상수 참조** — `spec/5-system/11-mcp-client.md` 가 참조하는
   `shared/utils/sanitize-error-message` 는 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`(에러
   메시지 redaction)이며, 이번에 이관된 `MASKED_MARKERS` 계열(egress 마스킹 마커)과는 다른
   식별자·다른 관심사다. 코드 diff 확인 결과 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 은
   이관 대상이 아니고 그대로 남아 있어, mcp-client spec 의 서술은 여전히 유효하다.

4. **`MAX_SANITIZE_DEPTH` (WS) vs `MAX_REDACT_DEPTH`/`MAX_MASK_DEPTH` (마커)** — 새 패키지
   주석·backend shim 주석·frontend shim 주석 세 곳 모두 "WS 의 `MAX_SANITIZE_DEPTH` 는 별개
   불변식이며 합치지 않는다(`depth > N` vs `depth >= N`, 프런트 스캐너는 WS 페이로드를 스캔하지
   않음)"를 동일하게 서술한다. `spec/5-system/6-websocket-protocol.md` 는 이 상수들을 전혀
   언급하지 않아(grep 0건) 충돌 표면이 없다.

5. **plan 연동** — `plan/in-progress/masked-marker-shared-package.md` 의 `spec_impact` 는
   `spec/5-system/14-external-interaction-api.md` 하나만 가리키며 실제 diff 범위와 일치한다.
   `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 두 이월 항목(":373", ":757")도
   같은 결정으로 정합적으로 닫혔다(체크박스 `[x]` + 대체 근거 병기).

6. **frontmatter `code:` 목록 배타성** — `codebase/backend/src/shared/utils/
   sanitize-error-message.ts` 와 `codebase/frontend/src/lib/utils/masked-markers.ts` 를 `code:`
   에 걸어 둔 spec 은 `spec/5-system/14-external-interaction-api.md` 하나뿐이라(grep 확인), 이번에
   두 파일이 "SoT → shim" 으로 성격이 바뀌어도 갱신이 필요한 다른 spec 문서가 없다.

### 요약

target 문서의 변경은 마스킹 마커 상수의 SoT 를 backend 단일 소유에서 신규 공유 패키지
(`@workflow/masked-markers`)로 옮기는 순수 리팩터 서술이며, 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC 어느 축에도 새 표면을 만들지 않는다. 계층 책임 관점에서도 저장소에 이미 확립된
"backend 생산·frontend 판정 값을 `codebase/packages/**` 공유 패키지로 두는" 패턴(`ai-end-reason`
선례)을 그대로 따르며, `frontend-layering.md` 규약(frontend 내부 계층 축)과는 스코프가 달라
상충하지 않는다. 인접 spec(`11-mcp-client.md`, `6-websocket-protocol.md`)이 참조하는 인접 상수들
(`SECRET_LEAK_PATTERNS`, `MAX_SANITIZE_DEPTH`)은 이번 이관 대상이 아니며 서술도 코드와 여전히
일치한다. `code:` frontmatter 를 공유하는 다른 spec 문서가 없어 연쇄 갱신 누락 위험도 없다.
Cross-Spec 일관성 관점에서 이 변경을 채택해도 다른 spec 영역이 깨지거나 모순되는 지점을
발견하지 못했다.

### 위험도
NONE
