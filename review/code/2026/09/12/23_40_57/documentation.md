# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 두 `decodeCursor` 의 근거 주석(~12줄)이 두 파일에 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64` (`decodeCursor` 내부 주석), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177` (`decodeCursor` 내부 주석)
  - 상세: `isUuidShaped`(`isValidUuid` 아님)를 고른 이유, 22P02→500 마스킹 메커니즘, `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"` 인용까지 두 파일에 사실상 동일한 산문이 그대로 복제되어 있다. 검증 로직 자체는 공용 유틸(`isUuidShaped`) 재사용이라 중복이 아니지만, 주석은 한쪽을 고치면 다른 쪽이 낡는(comment drift) 구조다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(diff 3168행대)에 "두 커서 디코더에 같은 근거 주석이 복제됐다"로 등재되어 있고, 이번 배치에서 반영하지 않은 이유(주석-only라 수렴 판정 축을 안 건드림, 고치면 `codebase/**` 재리뷰 필요)도 함께 적혀 있다. 근거를 잘 남겼으므로 이번 라운드에서 추가 조치는 불필요 — 참고용으로만 기록한다.

- **[INFO]** `isUuidShaped` JSDoc이 새 소비처(커서 id 검증)의 컨텍스트를 반영하지 않음
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16-41` (`isUuidShaped` JSDoc, 이번 diff에는 포함되지 않은 파일)
  - 상세: 해당 JSDoc은 "워크스페이스 헤더 vs 경로 파라미터"라는 인가(authorization) 컨텍스트를 주어로 근거를 서술한다. 이번 PR은 같은 함수를 "커서의 id 성분"이라는 리소스 지목(비-인가) 컨텍스트에 새로 재사용하는데, 함수 자체의 JSDoc은 갱신되지 않았다. 개발자 본인도 `plan/in-progress/keyset-cursor-uuid-validation.md`(§B, `--impl-prep` rationale_continuity INFO#2)에서 "적용 범위가 넓어진다"는 점을 명시적으로 인지하고 기록했다.
  - 제안: 이미 followups 문서에 "상세 근거를 `common/utils/uuid.ts`의 `isUuidShaped` JSDoc 한 곳으로 모으고 호출부는 짧은 참조로 압축"이라는 처리 방향이 등재되어 있다. 별도 조치 불필요 — 다음 라운드에서 그 항목을 처리할 때 함께 반영하면 된다.

## 확인한 항목 (문제 없음)

- CHANGELOG.md 신규 항목: 두 엔드포인트(`GET /api/users/me/login-history`, `GET /api/executions/:executionId/background-runs/:backgroundRunId`)의 경로가 실제 컨트롤러 데코레이터(`sessions.controller.ts` `@Get('login-history')` under `@Controller('users/me')`, `background-runs.controller.ts` `@Controller('executions/:executionId/background-runs')` + `@Get(':backgroundRunId')`)와 정확히 일치함을 확인했다. 두 엔드포인트의 처분 차이(200 vs 400)를 "의도"로 명시하고, 배포 시 확인 사항·필터 미수정 근거·인용 spec 경로까지 갖춰 정확하고 충실하다.
- `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"`(실제 섹션 헤딩 `### X-Workspace-Id 헤더 vs :id 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)`)과 `spec/5-system/3-error-handling.md §1`의 "JWT 클레임은 검증하지 않는다…" 인용문 모두 실측으로 원문 존재를 확인했다. 소급 지어낸 인용 없음.
- `login-history.service.ts`/`background-runs.service.ts`의 새 인라인 주석은 (a) 왜 검증이 필요한지(22P02→500 마스킹) (b) 왜 `isUuidShaped`이고 `isValidUuid`가 아닌지 (c) 형제 디코더와 처분이 왜 다른지를 모두 정확히 설명하며, 실제 코드 동작과 어긋나지 않는다.
- 테스트 파일 두 곳의 신규 테스트/주석(`login-history.service.spec.ts`, `background-runs.service.spec.ts`)은 기존 fixture가 결함을 "정상"으로 고정하고 있었다는 사실을 명확히 설명하고, 대조군(nil UUID) 테스트의 존재 이유를 정확히 기술한다.
- `plan/in-progress/keyset-cursor-uuid-validation.md`(신규): frontmatter(`spec_impact: none`)가 이번 PR 자체는 spec을 건드리지 않는 것과 일치하며, planner 소관으로 넘긴 3개 spec 갭 항목을 별도로 표시해 developer/planner 경계를 지켰다. 체크리스트 상태(`[x]`/`[ ]`)는 실제 진행 상태와 부합한다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`: 기각된 트래커 항목(`GlobalExceptionFilter` 22P02→400 분기)을 취소선(`~~...~~`)으로 원문을 보존한 채 종결 근거를 덧붙였고, 체크박스도 `[ ]`→`[x]`로 정확히 갱신했다. 새 spec 갭 3건은 "planner 항목"으로 명시적으로 라벨링되어 있다.
- API 문서(OpenAPI) 변경 불요 확인: `background-runs.controller.ts`의 `@ApiBadRequestResponse({ description: 'cursor 디코딩 실패 또는 limit 범위 오류' })`는 이미 일반적 서술이라 새 검증 분기를 별도로 문서화할 필요가 없다. `login-history` 쪽은 잘못된 커서를 무시하는 기존 동작(`ignores malformed cursor`)의 연장이라 OpenAPI 갱신 대상이 아니다.
- README/설정 문서: 새 환경변수·설정 옵션·신규 기능 없음 — README 업데이트 불요.

## 요약

이번 변경은 문서화 관점에서 이례적으로 충실하다. CHANGELOG는 두 엔드포인트의 처분 차이를 "의도"로 명시하고 배포 확인 사항·기각된 대안(필터 수정)의 근거까지 인용 경로 검증이 가능한 형태로 남겼으며, 인라인 주석은 왜 이 검증이 필요한지·왜 특정 술어(`isUuidShaped`)를 골랐는지·형제 코드와 왜 계약이 다른지를 정확하게 설명한다. plan 문서는 developer/planner 권한 경계, 체크박스 진행 상태, 기각된 트래커 항목의 취소선 보존을 CLAUDE.md 규약대로 지켰다. 유일하게 남는 것은 두 파일에 복제된 근거 주석과 `isUuidShaped` JSDoc의 컨텍스트 확장 미반영인데, 둘 다 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재·근거와 함께 명시적으로 이번 배치에서 다루지 않기로 한 항목이라 추가 조치가 필요하지 않다.

## 위험도

NONE
