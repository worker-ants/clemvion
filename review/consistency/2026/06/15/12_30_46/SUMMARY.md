# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — Cross-Spec 에서 인접 spec 2곳이 구현 완료와 불일치("Planned" 잔류·file 검증 미열거). 그 외 4개 checker 는 NONE/LOW.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | EIA spec §5.1 의 file 검증 항목이 `**Planned**` 로 표기 — 구현 완료 사실과 직접 모순 | `spec/4-nodes/6-presentation/4-form.md` §6.2 (validateFileField 구현 완료 명시) | `spec/5-system/14-external-interaction-api.md` §5.1 line 313 `400 VALIDATION_ERROR` 에러 행 | `**Planned**` 제거 후 "EIA·WS·UI 3 경로 공통. `type: 'file'` MIME/크기/개수 검증도 동일 chokepoint 에서 수행" 으로 대체 |
| 2 | Cross-Spec | WS spec §4.2 `VALIDATION_ERROR` 설명에 `type: 'file'` MIME/크기/개수 항목 누락 — WS 클라이언트 구현자가 file 검증 에러를 VALIDATION_ERROR 로 처리해야 함을 spec 에서 알 수 없음 | `spec/4-nodes/6-presentation/4-form.md` §6.2 (validateFileField → VALIDATION_ERROR 매핑 명시) | `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행 | 행 끝에 `·type:'file' MIME/크기/개수` 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | frontend `DEFAULT_FILE_*` 상수 미러 관계 spec 에 명시됨; 향후 drift 위험은 아키텍처 백로그 B-1 으로 추적 중이나 spec 본문에 백로그 참조 없음 | `spec/4-nodes/6-presentation/4-form.md` §1 | spec §1 SoT 문구에 `(런타임 공유 패키지 추출은 아키텍처 백로그 B-1)` inline 추가 — 선택적 |
| 2 | Cross-Spec | `image/gif` 가 allowedMimeTypes 기본 목록에 포함 — spec 과 구현 일치, 보안 정책 이슈 아님 | `spec/4-nodes/6-presentation/4-form.md` §1 | 조치 불필요 |
| 3 | Convention | spec `code:` frontmatter 에 `form-mode.ts`, `types.ts` 미등재 (단일 진실 원칙 사소한 gap) | `spec/4-nodes/6-presentation/4-form.md` frontmatter `code:` | `form-mode.ts`, `types.ts` 두 줄 추가 |
| 4 | Convention | spec §1.5 에 i18n 키 경로(`editor.runResults.formFile*`) 미명시 — 가독성 향상 제안 | `spec/4-nodes/6-presentation/4-form.md` §1.5 | `(i18n 키: editor.runResults.formFile*)` 한 줄 추가 — 선택적 |
| 5 | Naming | `MB_IN_BYTES` 상수가 backend export + frontend module-private + test 3중 미러 — 스코프 분리로 충돌 없음 | `form-mode.ts`, `dynamic-form-ui.tsx`, `dynamic-form-ui.test.tsx` | 미러 주석 이미 존재. 아키텍처 백로그 B-1 추출 전까지 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | EIA §5.1 "Planned" 잔류(WARNING), WS §4.2 file 항목 미열거(WARNING) |
| Rationale Continuity | NONE | coerceFormSubmission 제거·FIRST 오류 순서·frontend 복제·modal 배제 결정 모두 Rationale 과 정합 |
| Convention Compliance | LOW | spec code: frontmatter 미등재 2파일(INFO), i18n 키 경로 미명시(INFO); CRITICAL/WARNING 없음 |
| Plan Coherence | NONE | 선행 PR 모두 main 머지 확인, ValidationPreset 미접촉, 후속 항목 누락 없음 |
| Naming Collision | NONE | 신규 식별자 전원 기존 코드베이스와 충돌 없음; FormModalField 확장이 form.schema.ts 와 정합 |

## 권장 조치사항

1. **(WARNING 해소 — 권장)** `spec/5-system/14-external-interaction-api.md` §5.1 `400 VALIDATION_ERROR` 에러 행의 `**Planned**` 제거 및 "EIA·WS·UI 3 경로 공통" 문구로 대체.
2. **(WARNING 해소 — 권장)** `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행에 `·type:'file' MIME/크기/개수` 항목 추가.
3. **(INFO — 선택)** `spec/4-nodes/6-presentation/4-form.md` frontmatter `code:` 에 `form-mode.ts`, `types.ts` 두 줄 추가.
4. **(INFO — 선택)** spec §1.5 에 i18n 키 경로 주석 추가.