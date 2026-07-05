# 신규 식별자 충돌 검토 — spec-draft-auth-webauthn-list-format

## 검토 대상
- target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md`
- 변경 파일: `spec/5-system/2-api-convention.md` (§5.2 뒤 note 추가 + Rationale subsection 추가), `spec/5-system/1-auth.md` (line 469 응답 포맷 텍스트 정정)

## 분석 개요

본 target 은 **신규 식별자를 전혀 도입하지 않는다**. 변경 내역 3건 모두 다음 성격이다:

1. `2-api-convention.md` §5.2 뒤 note 삽입 — 새 섹션 번호·앵커·타입명 없이 산문 설명만 추가
2. `1-auth.md` line 469 표 셀의 "응답" 텍스트를 `[{...}]` (bare array) 에서 `{ data: { items: [...] } }` 로 정정 — endpoint(`GET /api/auth/2fa/webauthn/credentials`) 자체는 기존 그대로, 응답 포맷 서술만 실제 코드에 맞춤
3. `2-api-convention.md` `## Rationale` 에 신규 subsection 추가 — 결정 근거 서술, 새 식별자 없음

## 점검 관점별 확인 결과

### 1. 요구사항 ID 충돌
target 은 새 요구사항 ID를 전혀 부여하지 않는다. `spec/5-system/` 은 요구사항 ID 체계(`NAV-*`, `ED-*`, `ND-*`)를 쓰는 영역이 아니며 (0-overview.md §4: ID는 각 영역 `_product-overview.md` 소관), 본 target 이 건드리는 두 문서는 ID 부여 대상이 아니다. 해당 없음.

### 2. 엔티티/타입명 충돌
target 이 언급하는 `WebAuthnCredentialListDto` 는 신규 도입이 아니라 **기존 코드에 이미 존재하는 이름**을 spec 텍스트에서 인용한 것.

- 실제 정의: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:78` `export class WebAuthnCredentialListDto`
- 실제 사용: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:52, 277`

target 의 서술("`webauthn.controller.ts` `webauthnList` (`WebAuthnCredentialListDto { items }`)")은 이 기존 정의와 정확히 일치하며 충돌 없음. 새 DTO/엔티티명 도입 없음.

`sessions.controller.ts` 의 `{ data: { items: sessions } }` 반환도 실제 코드(line 74, 120, 164)와 일치 확인됨 — 인용 정확.

### 3. API endpoint 충돌
target 은 새 endpoint 를 추가하지 않는다. `GET /api/auth/2fa/webauthn/credentials` 는 `1-auth.md` line 469 에 **기존에 이미 정의된** endpoint이며, target 은 그 표 셀의 응답 포맷 서술만 교체한다(method+path 불변). 다른 spec 파일에 동일 endpoint 가 다른 의미로 정의된 사례 없음(grep 결과 `1-auth.md` 단독).

### 4. 이벤트/메시지명 충돌
target 은 webhook·queue·SSE 이벤트명을 도입하지 않는다. 해당 없음.

### 5. 환경변수·설정키 충돌
target 은 ENV var·config key 를 도입하지 않는다. 해당 없음.

### 6. 파일 경로 충돌
target 은 신규 spec 파일을 만들지 않고 기존 파일(`spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`) 두 곳을 in-place 수정한다. `plan/in-progress/spec-draft-auth-webauthn-list-format.md` 자체의 파일명은 프로젝트의 `spec-draft-*` 명명 컨벤션(다른 in-progress plan: `spec-draft-c2-atomic-claim.md`, `spec-draft-c3-context-drift.md`, `spec-draft-concurrency-cap-pr2b.md`, `spec-draft-crash-running-redrive.md`, `spec-draft-dataflow-exec-seq-3way.md` 등)과 일치하며 기존 파일과 겹치지 않음.

### 추가 확인 — 헤딩/앵커 충돌
- 새 Rationale subsection 제목("비-페이징 고정 컬렉션은 `{data:{items}}` 유지 (§5.2 페이징과 형태 상이)")은 `2-api-convention.md` 내 기존 `###` 헤딩 목록(§2.1~§12.2, §413, §Webhook 위임) 중 어느 것과도 텍스트가 겹치지 않음 — 신규 헤딩이며 충돌 없음.
- §5.2 인바운드 링크 앵커(`#52-목록-응답`)는 6개 타 spec 파일(`5-knowledge-base.md`, `4-integration.md`, `6-config.md`, `14-execution-history.md`, `2-trigger-list.md`, `1-workflow-list.md`)에서 참조 중이나, target 은 §5.2 헤딩 자체를 변경하지 않고 그 **뒤에 새 문단을 삽입**만 하므로 앵커 안정성 영향 없음.

### 추가 확인 — 동시 진행 plan 과의 충돌
`plan/in-progress/` 내 `1-auth.md`/`2-api-convention.md` 를 함께 언급하는 다른 in-progress 문서(`spec-sync-auth-gaps.md`, `exec-intake-followups.md`, `webhook-public-ip-failopen-hardening.md`, `webhook-spec-pointer-cleanup.md`, `competitive-analysis-n8n-flowise.md`, `rag-rerank-followup.md`, `spec-sync-data-flow-12-workspace-gaps.md`)을 확인한 결과, `spec-sync-auth-gaps.md` 는 WebAuthn 을 "이미 구현 확인됨"으로 1줄 언급할 뿐 응답 포맷·line 469 를 다루지 않음 — target 과 편집 대상 라인이 겹치지 않아 병행 진행 시 충돌 없음.

## 발견사항

없음. 신규 식별자 도입이 전혀 없으며(ID/타입/endpoint/이벤트/ENV/파일경로 모두 기존 사용처 인용 또는 기존 파일 in-place 정정), 인용된 기존 식별자(`WebAuthnCredentialListDto`, `sessions.controller.ts` 응답 형태, `§5.2` 앵커)는 실제 코드·spec 과 정확히 일치함을 확인했다.

## 요약

target 문서는 신규 식별자를 하나도 도입하지 않는 순수 spec-텍스트 정정(코드가 이미 구현한 `{data:{items}}` 응답 계약에 `1-auth.md` line 469 의 서술을 맞추고, `2-api-convention.md` 에 비-페이징 컬렉션 규칙을 명문화하는 note/Rationale 추가)이다. 언급되는 모든 이름(`WebAuthnCredentialListDto`, `sessions.controller.ts` 반환 형태, `§5.2` 섹션·앵커)은 기존 코드/spec 사용처와 정확히 일치하며, 새 헤딩·앵커·파일 경로 역시 기존 컨벤션과 충돌하지 않는다. 동시 진행 중인 다른 in-progress plan 과도 편집 대상 라인이 겹치지 않는다.

## 위험도

NONE
