# RESOLUTION — terminal re-review (round 4, origin/main..HEAD)

ai-review round 4: 위험도 MEDIUM, **Critical 0** / Warning 9 (+ INFO 10).
10개 reviewer 전원 Critical 없음(documentation 는 FS-write 갭 후 재실행으로 확인).

이 라운드의 diff 는 round-3 발견에 대한 test/doc/cosmetic fix 뿐이며, 잔여
WARNING 은 전부 **이미 추적된 follow-up** 또는 **저위험 후속 백로그**다. 리뷰
루프 수렴을 위해 코드 재변경 없이 disposition 한다(RESOLUTION 만으로 종결).

## Disposition (모두 비차단)

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | testing | `driveResumeAwaited`/`driveResumeFrame` 2경로의 `input:` 배선 인자 단언 부재(3경로 중 redrive 1경로만 e2e 결정적) | **후속(백로그)**: 3경로는 동일 `this.reentryWorkflowInput(savedExecution)` 호출이고 helper 는 단위테스트로 계약 고정 + redrive 는 e2e. 두 resume 경로 mock arg 단언은 hardening 후속(park-resume e2e 도 함께). 회귀하려면 그 2줄을 각각 `input:{}` 로 되돌려야 하는데 helper 패턴이 명백해 실질 위험 낮음 |
| W2 | testing | retry-turn `input:{}` "의도적 예외" 회귀 테스트 부재 | 후속(백로그) — helper 이동으로 교차주석은 명시됨. 불변식 mock 단언 추가는 저위험 후속 |
| W3 | api-contract/하위호환 | 잔존 malformed 워크플로우가 무관 저장까지 400(restore 예외) — 마이그레이션 없음 | **이미 추적**(R1 RESOLUTION W6): 의도된 트레이드오프 + 배포 전 실데이터 조회 권고. 운영 후속 |
| W4 | requirement/api-contract | 저장 시점 `INVALID_TRIGGER_PARAMETERS` spec §6 미문서 | **이미 추적**: `spec-update-manual-trigger-save-time-error-code.md`(project-planner). 코드 정당, 되돌림 불필요 |
| W5 | architecture | `validateManualTrigger` 가 `NodeHandler.validate()`(+`evaluateMetadataBlockingErrors`) 우회 | **수용 + 추적**: `details[]` 봉투 보존 위한 의도적 선택(R1/R3 동일 결론). blocking rule 추가 시 수렴 — spec-update follow-up 에 네이밍 각주 항목 포함 |
| W6 | maintainability | 파라미터 이름 정규식 프론트/백 이중 정의 | **후속(백로그)**: 공유 패키지 추출 + parity 테스트. 현재 동일값, CI 비차단 |
| W7 | maintainability | `trigger-configs.tsx` JSX 들여쓰기 혼재(eslint 통과, 렌더 무영향) | **수용**: 프로젝트 eslint 통과(prettier CLI 불일치는 memory 기록). 전체 `prettier --write` 지양 규약. 후속 reindent 백로그 |
| W8 | maintainability | `skipParamSchemaValidation` 위치 boolean 인자(단일 플래그) | **수용**: 플래그 1개·호출부 1개(restoreVersion). 2번째 플래그 필요 시 옵션 객체 전환 |
| W9 | scope | `schedule-runner.service.spec.ts` 무관 포맷팅 diff | **수용**(R1 W7): 사전 존재 prettier 에러라 lint 통과에 필요. 커밋 메시지 근거 명시 |
| doc-W(재실행) | documentation | plan 체크리스트 stale / 저장 시점 spec 미갱신 | plan 체크리스트 R2~R4 반영 갱신(본 커밋). spec 은 W4 follow-up |
| INFO ×10 | 다수 | Swagger 문구·ERROR_KO·트리거 이름 검증 dup count·validation-errors.mdx 등 | 전부 비차단 후속/설계 선택 — 상세 각 reviewer md |

## 근본원인 fix 검증(재확인)

3대 근본원인 — (c) 엔진 재진입 durable input, (b) `type='manual_trigger'` 조회,
(② save-time 스키마 게이트) — requirement reviewer 가 line-level spec 일치 확인.
security NONE, 순환 의존 없음, 하위호환 리스크는 운영 후속으로 명시 이연.

## TEST 결과

- lint: 통과
- unit: 통과 (reentryWorkflowInput 단위 포함)
- build: 통과
- e2e: 통과 (247/247, 결정적 재진입 + crash-redrive/stalled/park 무회귀)

## 보류·후속 항목 (백로그/운영/planner)

- spec-update(§6 표·data-flow·handler.validate 네이밍) → `spec-update-manual-trigger-save-time-error-code.md` (project-planner)
- 잔존 malformed 워크플로우 백필/조회 (운영, 배포 전)
- resume-path input arg 단언 + retry-turn 불변식 테스트 (test hardening 백로그)
- 파라미터 이름 정규식 공유 패키지 + parity 테스트 (백로그)
- security 예약어 배제 / i18n ERROR_KO 등록 (백로그)
