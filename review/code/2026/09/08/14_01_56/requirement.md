# 요구사항(Requirement) 코드 리뷰

## 발견사항

- **[WARNING]** B-1(`타입체크 ratchet 을 run-test.sh build 단계로 편입`)의 실제 대상 스크립트 두 개의 자기-서술이 이 배치 이후 거짓이 됐는데, 이 배치는 그 두 파일을 건드리지 않았다
  - 위치: `scripts/check-backend-typecheck-ratchet.py` — `## 로컬에서 돌리는 법` 섹션(`` `.claude/tools/run-test.sh` 의 4단계에는 **없다**(그 wrapper 는 lint/unit/build/e2e 고정). `` 문장), `scripts/check-frontend-typecheck-ratchet.py` 의 동일 섹션(같은 문장)
  - 상세: 이번 배치(B-1)는 정확히 `.claude/test-stages.sh` 의 `cmd_build()` 에 `_cmd_typecheck_ratchets()` 를 배선해 두 ratchet 스크립트를 `run-test.sh build` 4단계 **안으로** 편입시켰다(`.claude/test-stages.sh:80-96`, `PROJECT.md:43-56` 에도 "2026-09-08 부터 build 단계 안에서 함께 돈다" 고 명시). 그런데 정작 두 ratchet 스크립트 자신의 모듈 docstring 은 여전히 `` `.claude/tools/run-test.sh` 의 4단계에는 **없다** `` 라고 적고 있다 — 이 배치가 도입한 바로 그 사실과 정면으로 모순된다. 두 파일 모두 `git log -1` 확인 결과 이 배치가 손대지 않은 채(마지막 수정 `#1263`) 그대로 남아 있다. 공교롭게도 이 배치는 정확히 같은 클래스의 결함(`build tsc 가 __test-utils__ 를 컴파일한다`는 낡은 전제)을 `source-scan.ts`·`workspace-id-fixtures.ts`·`oauth-config-mock.ts` 세 파일에서는 취소선+정정으로 고쳤으면서, 그 트리거가 된 실제 진입점 스크립트 두 개는 놓쳤다. 다음에 이 스크립트만 열어보는 사람은 "여전히 wrapper 밖의 수동 실행 대상"이라고 오판하게 된다.
  - 제안: 두 스크립트의 `## 로컬에서 돌리는 법` 문장을 "2026-09-08 부터 `run-test.sh build`(= `.claude/test-stages.sh` `cmd_build()`) 안에서 자동 실행된다. 개별 실행이 필요하면 아래 명령을 직접 부른다" 형태로 정정한다. `PROJECT.md`/`source-scan.ts` 등이 이미 쓴 것과 같은 취소선+정정 관례를 따르면 된다.

- **[INFO]** `webhook-trigger.e2e-spec.ts` B4 의 신규 e2e 는 spec 문구(§1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT`)와 line-level 로 정확히 일치한다
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213` (`it('B4. …')`)
  - 상세: `spec/5-system/3-error-handling.md:238` (`TRIGGER_ENDPOINT_PATH_CONFLICT | RESOURCE_CONFLICT / 409 … details.field='endpoint_path'`)와 대조 — 테스트가 단언하는 `dup.status===409`, `error.code==='RESOURCE_CONFLICT'`, `error.details==={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}` 가 정확히 그 문장과 일치한다. `global-exception-filter`/`throwIfUniqueViolation` 경로가 top-level `code` 를 교체하지 않고 `details` 에만 세부 사유를 싣는 §5.3 택일 규칙도 지켰다. 드라이버 원문(`duplicate key`) 비노출 단언도 CWE-209 축과 부합한다. 결함 없음, 참고로 기록.

- **[INFO]** `listMembers` DB 투영이 `spec/1-data-model.md §2.1.1`·`## Rationale` 의 "엔티티 전역 `select:false` 기각" 결정과 실제로 다른 층(쿼리 레벨)이라는 코드 주석의 구분이 스펙 본문과 일치한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:216-231`
  - 상세: `spec/1-data-model.md:93`(엔티티 전역 `select:false` 기각 — 내부 경로가 값을 직접 소비해 fail-silent)과 `:957-983`(`## Rationale` — "값을 읽는다"→응답 경계에서 지운다, `select:false` 금지 / "WHERE 절에만 쓴다"→`select:false` 유효, 두 축 분리표)를 직접 열어 대조했다. 이번 변경은 `User` 엔티티 데코레이터를 건드리지 않고 `MemberRepository.find()` 호출 하나의 쿼리 옵션에만 `select`를 얹었으므로, 스펙이 기각한 "엔티티 전역 `select:false`"와는 다른 대상이며 코드 주석도 그 구분을 정확히 적고 있다. spec 위반 아님(회색지대 INFO — 두 층 구분 자체는 스펙 §2.1.1 본문이 명시적으로 다루지 않으나 인접 `## Rationale` 결정표와 결이 일치한다). 참고로 같은 세션의 consistency-checker 가 이미 "쿼리 범위 select 투영이 두 번째 적용됐는데 Rationale 표에 하위 각주로 등재되지 않았다"는 지적을 냈다(`review/consistency/2026/09/08/13_34_30` rationale_continuity — INFO, project-planner 턴 대상)는 점만 상기시킨다 — 본 리뷰의 새 지적은 아니다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts` 의 실측 화이트리스트(래핑됨 2곳/래핑안됨 6곳)가 `TriggersService` 실제 소스와 정확히 일치한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts:49-68` vs `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`/`update` 는 `.catch(rethrowEndpointPathConflict)` 로 래핑, `normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`(2곳)·`cleanupRotatedChatChannelTokens` 는 미래핑)
  - 상세: 함수명·저장 위치를 grep 으로 직접 대조해 8개 저장 호출 전부가 화이트리스트와 1:1 일치함을 확인했다. B-6 의 처방("`endpointPath` 를 대입·갱신하는 메서드의 `save()` 는 래핑돼야 한다")을 그대로 구현하지 않고 spec 헤더가 스스로 그 술어가 vacuous(스프레드 경유라 토큰이 안 잡힘)임을 실측·기록한 뒤 "모든 save 를 세고 래핑되거나 화이트리스트에 있어야 한다"로 뒤집었는데, 이는 `plan/` 문서의 처방 변경이지 `spec/` 요구사항 위반이 아니다(대상 문서는 `plan/in-progress/spec-followups-batch-b.md` — SoT 아님). 새 술어 자체는 fail-safe 방향(새 `save()` 발생 시 무조건 실패)이라 요구사항을 오히려 더 잘 만족한다. 결함 없음.

- **[INFO]** 전역 예외 필터의 `isPostgresUniqueViolation` 전환 — spec §2-api-convention.md 의 "409 → `RESOURCE_CONFLICT`" 기본값과 line-level 로 일치
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70-75`, `:142-143`(`getCodeFromStatus`)
  - 상세: `spec/5-system/2-api-convention.md:190`(`409=RESOURCE_CONFLICT`)과 일치. 회귀 테스트(raw 23505→409, raw 23502→500) 양방향 모두 실제 파일을 열어 로직과 대조했고 어긋남 없음. `pg-error.ts` 의 `pgErrorCode`/`pgErrorConstraint` 가 `err.code ?? err.driverError?.code` 두 표면을 모두 흡수하는 것도 확인했다 — 종전 로컬 `isUniqueViolation` 이 `driverError.code` 표면만(그것도 `instanceof QueryFailedError` 선행 조건 하에) 봤던 것과 대비된다는 CHANGELOG 서술이 실측과 일치한다.

## 요약

핵심 8개 항목(B-1~B-8) 중 코드로 확인 가능한 기능적 요구사항은 모두 의도한 대로 구현돼 있다 — `pg-error.ts` SoT 로의 전역 필터 통합(raw 표면 23505→409 회귀 수정), `listMembers` DB 레벨 투영(응답 wire 불변), `endpoint_path` 충돌 AST 래칫(실제 소스의 8개 `save()` 호출과 화이트리스트가 1:1 일치), 신규 e2e(§1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 계약과 line-level 일치), `WorkflowVersionDetailProjection` 개명(잔존 참조 0건) 모두 직접 소스·spec 대조로 검증했고 불일치가 없다. 유일한 실질적 공백은 이 배치 자신의 취지("build 가 제외한 자리는 타입체크 사각"이라는 낡은 자기-서술을 정정한다")가 정작 그 취지의 근원인 `scripts/check-{backend,frontend}-typecheck-ratchet.py` 두 파일의 "wrapper 4단계에는 없다" 문장에는 반영되지 않아, 이번 B-1 변경 직후 그 문장이 거짓이 됐다는 점이다(WARNING 1건). 나머지는 spec fidelity 관점에서도 어긋남을 찾지 못했다.

## 위험도

LOW
