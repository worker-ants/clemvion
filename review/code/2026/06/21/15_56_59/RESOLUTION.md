# RESOLUTION — M-7 채널 authorizer 도메인 역전

리뷰 세션: `review/code/2026/06/21/15_56_59/` (위험도 **LOW**, Critical 0, Warning 6).
적용자: main (bg-worktree 환경에서 Agent subagent 의 Edit/Write 격리 가능성 → main 직접 수정).

재검증: lint·build·unit(40 suites, gateway+authorizer 78 케이스)·**e2e 205 PASS** (handleSubscribe
fail-closed 분기 + Kb UUID 가드 추가 후 DI 부팅·구독 ack 계약 무회귀).

## Warning

| # | 카테고리 | 처리 | 내용 |
|---|----------|------|------|
| 1 | 보안/요구사항 | **FIXED** | `KbChannelAuthorizer` 에 `isValidUuid(documentId)` 가드 추가. `Document.id = @PrimaryGeneratedColumn('uuid')` 이고 `verifyDocumentOwnership` 는 raw SQL `d.id = $1` 이라 비-UUID 는 Postgres uuid 캐스팅 오류 → 기존 `.catch(()=>false)` 로 **이미 거부**되던 입력 — DB 조회 전 선차단으로 바꿔 execution/workflow/background:run 과 W-6 정책 일관화(**동작 보존**: 비-UUID 는 양쪽 다 거부). 관련 테스트(gateway spec `kb:doc-abc/doc-victim/doc-A/doc-B` → UUID, kb authorizer spec) 갱신 + 비-UUID 거부·false-path 케이스 추가. |
| 2 | 요구사항/보안 | **DEFER** | `notifications:` 의 `!workspaceId` 선행 가드는 **M-7 이전부터 존재**(옛 gateway 인라인 authorizer 블록 동형). `handleConnection` 이 인증 시 JWT 에서 `workspaceId` 를 항상 세팅하므로 정상 경로 무영향. JWT 타입을 non-optional `workspaceId` 로 강화하는 건 WS 인증 전반의 cross-cutting 변경이라 behavior-preserving 리팩터(M-7) 범위 밖 — 후속 후보. 회귀 아님. |
| 3 | 유지보수성 | **DEFER** | 채널 prefix 리터럴 이중 관리(`VALID_CHANNEL_PREFIXES` vs authorizer `matches`/`slice`)는 **M-7 이전 인라인 authorizer 에도 존재**하던 패턴. `VALID_CHANNEL_PREFIXES` 를 런타임 주입 배열에서 파생하면 module-level 순수 함수 `isValidChannel` 이 DI 상태에 결합 → 순손해. 본 warning 이 우려하는 "동기화 어긋남" 위험은 W-5(fail-closed 기본 거부)+W-6(개수 assertion)으로 봉인. 유지보수 nit, 후속 후보. |
| 4 | 유지보수성 | **DEFER** | `useFactory` inject 목록 module/spec 이중 관리는 gateway spec 이 **prod provider wiring 을 의도적으로 미러링**(integration 성격 가치). 무음 drift 위험은 W-6 개수 assertion 테스트로 가드. 공유 `buildChannelAuthorizerProvider` helper 추출은 테스트 투명성↔DRY 트레이드 — 보류. |
| 5 | 테스팅/보안 | **FIXED** | `handleSubscribe` 에 fail-closed 기본 거부 추가 — `isValidChannel` 통과 채널이 매칭 authorizer 가 없으면 `success:false, 'Not authorized for this channel'` 반환. 현재 모든 valid prefix 에 authorizer 존재라 정상 경로 무변(방어적). gateway spec 에 authorizer 배열을 비워 분기를 강제하는 테스트 추가. |
| 6 | 아키텍처/테스팅 | **FIXED** | gateway spec 에 "주입된 authorizer 정확히 5개" assertion 추가 — module/spec wiring 동기화 drift 조기 감지. |

## Info (선택 처리)

| # | 처리 | 내용 |
|---|------|------|
| SPEC-DRIFT (§3.3) | **무변경** | spec §3.3 의 `channelAuthorizers`(OCP, "배열 항목 추가로 확장")는 M-7 후에도 성립 — gateway 필드명 `channelAuthorizers` 유지, 배열은 여전히 provider 추가로 확장(이제 useFactory 경유). spec 과 모순 없음. `/consistency-check --impl-done` 으로 확정(BLOCK 시 §3.3 문구 갱신을 project-planner 위임). |
| W-7 (notifications async) | **DEFER** | `Promise.resolve(...)` 래퍼는 의도적 — `async` 무-await 전환 시 `@typescript-eslint/require-await` 위반. 옛 인라인 authorizer 도 같은 이유로 동일 패턴. |
| W-9 (isValidUuid 단위 테스트) | **FIXED** | `common/utils/uuid.spec.ts` 신설(버전/variant nibble·길이·구분자·비-hex 경계 테이블). |
| W-10 (kb false-path) | **FIXED** | kb authorizer spec 에 ownership false-resolve 거부 케이스 추가. |
| W-11 (bg throw-path) | **FIXED** | background-run authorizer spec 에 ownership throw → catch 거부 케이스 추가. |
| inbound executionId UUID 검증 | **DEFER** | subscribe 경로 밖(form/button/message/retry inbound 핸들러)의 UUID 검증 누락은 M-7(구독 authorizer 역전) 범위 밖 + ORM 파라미터화 쿼리로 인젝션 차단됨. 후속 후보. |
| BackgroundRunsService export | **NOTED** | gateway 직접 참조는 제거됐으나 타 소비처 가능성 있어 export 유지 — 별도 audit 후 후속 PR 에서 제거 검토. |

## 결론

Critical 0. Warning 6 중 3건(W-1·W-5·W-6) FIXED, 3건(W-2·W-3·W-4) 근거와 함께 DEFER(전부 pre-existing
또는 범위 밖 maintainability nit, 회귀 없음). 보안 관련 INFO 테스트 갭(W-9/W-10/W-11) 보강. resolution 이
코드를 변경했으므로 본 리뷰는 stale → 본 변경을 커버하는 **fresh /ai-review** 1회 추가 수행.
