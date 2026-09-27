# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** PATCH 요청 DTO 의 NOT NULL 컬럼 필드에 `null` 을 보내면 여전히 500(`INTERNAL_ERROR`)이 난다 — 이번 diff 의 회귀는 아니고, 이 PR 이 프로브로 실측해 별도 트래커 항목으로 명시적으로 좁혀 등재했다.
  - 위치: `plan/in-progress/patch-body-followups.md`(실측 표, "실측 (2026-09-27, origin/main `6acc4dbc5`)" 절) / `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 항목 "PATCH 의 NOT NULL 필드에 `null` 을 보내면 500 이다")
  - 상세: `@IsOptional()` 이 `null` 도 "값 없음" 으로 보고 이후 검증기(`@IsString` 등)를 건너뛰어, `Workflow.name/tags/isActive` · `Node.config` · `AuthConfig.name/isActive` · `Folder.name` 같은 NOT NULL 컬럼에 `null` 이 그대로 병합되고 저장 시 Postgres 23502 위반이 전역 예외 필터에서 500 으로 떨어진다. 노드 `label: null` 은 라벨 중복 검사가 엉뚱하게 409 를 낸다. 클라이언트 입력이 500 을 만드는 형태라 원칙적으로는 400 이 맞다.
  - 제안: 이번 PR 범위가 아님(이미 스코프를 좁혀 트래커에 등재, 처방 방향도 `keyset-cursor-uuid-validation.md §A` 기각 근거를 인용해 명시함) — 조치 불요. 기재하는 이유는 "요구사항 완전성" 관점에서 PATCH tri-state 의 세 번째 칸(NOT NULL 필드에 대한 null)이 여전히 미해결임을 남기기 위함.

- **[INFO]** `ipWhitelist` 의 "화이트리스트 없음" 표현이 `null` 과 `[]` 두 값으로 영구히 공존하며 서비스 계층에서 canonical 값으로 정규화하지 않는다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` `ipWhitelist?: string[] | null;`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:400`(`if (ac.ipWhitelist?.length)`)
  - 상세: `null` 로 지운 뒤 GET 하면 `null` 이, `[]` 로 지운 뒤 GET 하면 `[]` 가 그대로 응답에 실린다. `verifyWebhookRequest` 의 판정(`?.length`)은 둘 다 falsy 로 동일 취급하므로 enforcement 는 정확하지만(`it.each(['null', null], ['빈 배열', []])` 로 확인됨), 응답 계약상 두 형태가 모두 유효한 "empty" 로 남는다.
  - 제안: 의도된 설계로 문서화돼 있어(CHANGELOG "null 과 빈 배열이 같은 뜻") 차단 사유 아님. 저장 시 하나의 canonical 값으로 정규화하는 것은 향후 개선 여지.

## Spec Fidelity 확인 (일치)

- `spec/5-system/2-api-convention.md` §5.4 "부재 표현" 절이 **정확히 이 패턴을 정의**한다: "요청 DTO 에서는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합이 정당하다(선례: `UpdateAssistantSessionDto.llmConfigId`)." 이번 PR 이 `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 세 필드를 이 형태로 정확히 맞췄다 — line-level 로 spec 문구와 구현이 일치. spec 이 이미 이 필드 형태를 명시적으로 승인하고 있어 CRITICAL/SPEC-DRIFT 대상 아님.
- `spec/5-system/12-webhook.md` WH-SC-09("AuthConfig.ip_whitelist 가 설정된 경우...")는 "설정 안 됨"의 두 형태(`null`/`[]`)를 구분하지 않으며, 구현(`ac.ipWhitelist?.length`)도 둘을 동일하게 "미설정"으로 다뤄 spec 과 모순 없음.
- `spec/1-data-model.md` §2.17 은 저장 시 형식 검증만 규정하고 tri-state 의미는 다루지 않음(요청 바디 의미는 §5.4 소관) — 회색지대, 불일치 아님.

## 기능 완전성 · 검증 확인

- **null-clear 경로**: `omitUndefined` 는 `null` 을 남기고(JSDoc·구현 일치), 세 서비스(`workflows.service.ts:249`, `nodes.service.ts:78`, `auth-configs.service.ts:247`)가 `rest`/`dto`(항상 객체, `data` 자체가 아님)에 대해 호출해 필드째 `null` 이 될 위험을 실제로 피한다 — 과거 `settings: null` 500 버그의 재발 형태를 정확히 피해감(workflows.service.ts:256-257 의 `settings != null` 가드 재확인).
- **e2e E1/E2/E3**: 1R 에서 하나였던 `it`을 리소스별로 분리, 각각 null 아님 값으로 픽스처를 만든 뒤 PATCH→응답→GET 3단계를 모두 단언 — 1R WARNING(W2) 이 정확히 해소됨.
- **헬퍼 null 인자 캐너리**: `omit-undefined.spec.ts` 에 `omitUndefined(null)` → `TypeError` 단언 추가 — 1R WARNING(W1) 정확히 해소됨.
- **CHANGELOG "null=[] 동치" 주장의 enforcement 레벨 실측**: `auth-configs.service.spec.ts` 의 `it.each(['null', null], ['빈 배열', []])` 가 `verifyWebhookRequest` 레벨에서 두 값이 동일하게 "통과"로 판정됨을 확인 — CHANGELOG 문구와 실제 동작이 일치.
- **swagger 가드 사각지대 캐너리**: 데코레이터·타입을 함께 되돌리는 회귀(원래의 과소 광고 상태)를 잡는 캐너리가 3개 DTO 스펙 파일 모두에 있고, plan 의 뮤턴트 표(D1~D6, N1, W1, W2)가 "캐너리 없이는 생존"을 실측으로 뒷받침한다 — 근거가 있는 설계 주장.
- **엣지 케이스**: null vs undefined vs 빈 배열 세 값 모두 검증기·서비스·enforcement 세 레벨에서 개별 테스트로 커버됨. 반환값 경로(200 상태 코드, `data` 필드 값)도 모든 e2e 케이스에서 명시적으로 단언됨.
- **TODO/FIXME/HACK/XXX**: diff 전체(`git diff origin/main HEAD -- codebase/`)에서 0건.
- **의도-구현 일치**: 헬퍼 JSDoc(`omit-undefined.ts`)이 서술하는 계약과 실제 동작이 일치. 단, `INFO`(documentation reviewer 도 지적) — `UpdateNodeDto.description` 필드 인라인 JSDoc 만 "(null 이면 지운다)"를 반영했고 `UpdateWorkflowDto.description` · `UpdateAuthConfigDto.ipWhitelist` 인라인 JSDoc 은 미갱신(OpenAPI `@ApiPropertyOptional description`은 셋 다 정확히 갱신됨 — 계약 SoT 에는 영향 없음). 이미 1R SUMMARY INFO 6 으로 지적·조치 불요 처분됨.

## 재현/뮤테이션 시도 여부

가설 검증을 위해 `Read`/`Bash`(읽기 전용)만 사용했다. 저장소 파일 뮤테이션·백업 파일 생성 없음. `git status --short` 확인 결과 세션 산출 디렉터리(`review/code/2026/09/27/16_07_49/`) 외 변경 없음.

## 요약

이번 diff 는 1R `/ai-review`(Critical 0, Warning 2)에서 지적된 두 항목(헬퍼 null 인자 미핀 테스트, e2e 케이스 리소스 혼재)을 정확히 해소했고, 세 요청 DTO 의 `nullable` 선언·타입을 이미 그렇게 동작하던 런타임에 맞추는 작업이 spec(`spec/5-system/2-api-convention.md §5.4`)이 명시적으로 승인한 패턴과 line-level 로 일치한다. null/undefined/빈 배열 세 값의 경계 처리가 검증기·서비스·enforcement·e2e 네 레벨에서 모두 테스트로 고정돼 있고, 뮤테이션 실측(D1~D6·N1·W1·W2)이 그 커버리지의 실효성까지 확인했다. 유일하게 남는 것은 이번 PR 이 스스로 발견해 명시적으로 스코프 밖으로 좁혀 트래커에 등재한 기존 결함(NOT NULL 필드에 `null` PATCH → 500)뿐이며, 이는 이 PR 의 책임 범위가 아니다. Critical 발견사항 없음.

## 위험도

NONE
