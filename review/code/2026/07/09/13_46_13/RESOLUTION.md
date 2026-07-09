# RESOLUTION — final re-review (round 3, origin/main..HEAD)

ai-review round 3: 위험도 MEDIUM, **Critical 0** / Warning 5 (+ SPEC-DRIFT 1, INFO 10).
9개 reviewer 모두 Critical 없음(scope·user_guide_sync 는 FS-write 갭 후 재실행으로 확인).

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | testing | 재진입 durable-input fix 3개 호출부 중 redrive(`driveStuckRedrive`) 1곳만 결정적 검증 | **테스트 보강**: (a) `reentryWorkflowInput` 순수함수 단위 테스트 추가(inputData verbatim / null·undefined→{}) — 3개 호출부 공통 helper 계약 고정, (b) 결정적 e2e 는 redrive 경로를 이미 커버. resume 2경로는 완료 트리거를 skip 하므로 트리거 재실행이 없어 e2e 대상 아님(단위로 helper 계약 보장) |
| W2 | side_effect | helper 주석의 적용 범위("미완료 진입 노드")가 실제(`gatherNodeInput` 폴백 = back-edge 재진입 타깃 등 포함)보다 좁음 | helper docblock 을 "predecessor 미실행 노드(진입 트리거 + back-edge 재진입 타깃)" 로 정정 |
| W3 | maintainability | 신규 helper 삽입으로 `runNodeDispatchLoop` 40줄 JSDoc 이 orphan | helper(+JSDoc)를 `runNodeDispatchLoop` JSDoc **앞**으로 이동 → doc-선언 인접성 복원 |
| W4 | documentation | CHANGELOG 제목 태그 `§4/§5.1` < 본문 `§4/§5.1/§6` | 제목을 `§4/§5.1/§6` 로 일치 |
| W5 | documentation | spec §6 "handler.validate (저장 시점)" 표현이 실제 우회 구현(`validateManualTrigger`→`validateTriggerParameterSchema`)과 네이밍 불일치 | `spec-update-manual-trigger-save-time-error-code.md` 체크리스트에 각주 정정 항목 추가(project-planner) |
| SPEC-DRIFT | requirement/api_contract | 저장 시점 `INVALID_TRIGGER_PARAMETERS` 가 spec §6 표 미반영(코드 정당, spec 이 따라가야 함) | 코드 변경 불필요 — `spec-update-…` follow-up 으로 project-planner 위임(이미 추적) |
| user_guide_sync W | user_guide | 유저 가이드 `triggers.mdx`/`.en.mdx` Callout 이 "실행 시점만 거부" 로 stale (PROJECT.md same-turn 원칙 대상) | **same-turn 수정 완료**: ko/en Callout 을 저장 시점 거부 + 편집기 inline 오류로 갱신(i18n parity 확인) |
| scope INFO | scope | `workflows.service.ts:293` `settings ... as Record` 캐스트가 직접 `eslint --fix` 로 오제거됨(무관 변경) | 캐스트 원복(origin/main 과 일치, scope 축소) |

## 수용/후속 (비차단)

| # | 발견 | 처분 |
|---|---|---|
| W2-scope INFO(security) | 식별자 정규식이 `__proto__`/`constructor`/`prototype` 미배제 | 자기소유 실행 컨텍스트 내 로컬 객체 한정(크로스테넌트/전역 오염 없음), 기존 코드 유래. defense-in-depth 는 후속 백로그 |
| INFO(하위호환성) | 잔존 malformed 워크플로우가 무관 저장까지 400(restore 는 예외) | 11_08_21 RESOLUTION W6 에서 "의도된 트레이드오프" accept, 배포 전 실데이터 조회 권고(운영 후속) |
| INFO(i18n) | `INVALID_TRIGGER_PARAMETERS` `ERROR_KO` 미등록 | pre-existing(신규 갭 아님), progressive allowlist CI 비차단 — 후속 |
| INFO(testing) | retry-turn 의 의도적 `input:{}` 불변식 회귀 테스트 | 후속(백로그) — 저위험 |
| INFO(regex parity) | 프론트/백 정규식 parity 테스트 부재 | W5 공유 패키지 추출(백로그)과 함께 |
| INFO(기타 문서/swagger 문구) | 교차 문서 사소한 정합 | 비차단, 후속 그루밍 |

## TEST 결과

- lint: 통과 (직접 `eslint --fix` 가 오제거한 캐스트는 원복; lint 스테이지는 warning 만)
- unit: 통과 (신규 `reentryWorkflowInput` 단위 테스트 포함)
- build: 통과
- e2e: 통과 (결정적 재진입 테스트 포함)

## 보류·후속 항목

- W5/SPEC-DRIFT: `spec-update-manual-trigger-save-time-error-code.md` (project-planner)
- security 예약어 배제 / regex 공유 패키지 / retry-turn 불변식 테스트 / i18n ERROR_KO: 백로그
