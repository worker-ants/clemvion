# RESOLUTION — ai-review 12_09_39 (A-2 file validation cluster)

RISK **LOW** · Critical **0** · Warning **3** · INFO 16. 수동 resolution (main, 전 컨텍스트 보유).
fix commit: `062bd3e1` (refactor(form): ai-review 후속).

## 조치 항목

| SUMMARY # | 분류 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | 아키텍처/유지보수 | DEFAULT_FILE_* 상수 backend/frontend 중복 | **accept** — spec §1 이 SoT, CSR(Next) 번들이 backend NestJS 모듈을 직접 import 불가 → 두 런타임 미러 불가피. frontend 상수 JSDoc 에 근거·동기화 의무 명시. 공유 패키지 추출은 검증 로직 전체 승격(B-1)과 함께 — 본 cluster 범위 밖(아래 후속) | 062bd3e1 |
| W2 | 아키텍처 | validateFormSubmission(scalar) vs execution-engine 루프 이원화 | validateFormSubmission JSDoc 에 scalar 전용 경로·새 규칙 추가 위치(validateScalarField/validateFileField) 명시 | 062bd3e1 |
| W3 | 부작용/유지보수 | hooks.service.ts file 검증 부재 미문서화 | 호출부에 "file 은 modal 미수용이라 미도달, EIA 경로만 validateFileField" 주석 | 062bd3e1 |
| INFO#1 | SPEC-DRIFT | spec §1.5 `multiple={maxFiles>1}` 스니펫이 방어적 구현과 상이 | spec §1.5 를 `(maxFiles ?? 1) > 1` 로 정렬 (본 PR 이 form.md 편집 중이라 직접 반영) | 062bd3e1 |
| INFO#4 | robustness | file 숫자 제약이 Infinity 수용(무제한 size) | extractFormFields 를 Number.isFinite 가드로 일관화(NaN/Infinity 거부 — min/max 규칙과 동일) + 테스트 | 062bd3e1 |
| INFO#2 | 테스팅 | maxTotalSize 클라 reject 테스트 누락 | dynamic-form-ui.test 합계 초과 케이스 추가 | 062bd3e1 |
| INFO#3 | 테스팅 | validateFileField required+충족→null 미검증 | form-mode.spec 양방향 케이스 추가 | 062bd3e1 |
| INFO#5 | 테스팅 | 빈 type(확장자 없는 파일) MIME skip 미명시 | frontend 통과 케이스 + JSDoc 의도 명시 | 062bd3e1 |
| INFO#6 | 문서화 | workflow-errors.ts JSDoc 낡은 참조 | validateScalarField/validateFileField 로 갱신 | 062bd3e1 |
| INFO#8/9 | 문서화 | validateFilesClient i18n 키 와일드카드·복제 근거 미명시 | JSDoc 에 4개 키 명시 + 상수 블록에 번들 분리 근거 | 062bd3e1 |
| INFO#10 | 일관성 | execution-engine.service.spec 리터럴 1024*1024 | MB_IN_BYTES import 사용 | 062bd3e1 |

### accept / defer (조치 안 함)

| SUMMARY # | 분류 | 사유 |
|---|---|---|
| INFO#7 | 문서화 | validateFileField JSDoc SoT 줄에 이미 전체 spec 경로(`spec/4-nodes/6-presentation/4-form.md §1.5/§6.2/§1`) 명기 — 본문 단축 표기는 SoT 줄로 충분 |
| INFO#11 | 유지보수 | fileMeta 헬퍼 위치(describe 중간) — 해당 file 테스트 묶음 바로 위라 지역성 충분. 순수 cosmetic, defer |
| INFO#12 | 유지보수 | frontend 테스트 로컬 `MB` — backend MB_IN_BYTES 는 cross-package 라 frontend 테스트가 import 불가(W1 과 동일 경계). 로컬 상수 유지가 정당 |
| INFO#13 | 아키텍처 | renderField 파라미터 6개 — renderFileField 분리는 중장기 리팩토링(B). 현 규모 과한 추상화, defer |
| INFO#14 | 보안 | image/svg+xml 기본 허용 — 현 metadata-only 라 무위험. 파일 서빙 경로 도입 시 CSP/별 origin 정책(향후 surface). spec §1 기본목록은 의도된 문서/이미지 허용 |
| INFO#15 | 보안 | ReDoS — pattern 은 노드 관리자 config(신뢰 경계) 전용 + MAX_PATTERN_LENGTH 512 cap. 일반 사용자 패턴 허용 시 re2 검토(#610 에서 이미 동일 결론) |
| INFO#16 | 테스팅 | file required 미제출 통합 케이스 — 단위(validateFileField required)로 커버, 통합 우선순위 낮음. defer |

## TEST 결과

- lint: 통과 (eslint --fix 무관 3파일 production-guards·auth.service.spec git checkout revert)
- unit: 통과 (backend form-mode 437 / 전체 40 suite PASS, frontend 17 dynamic-form-ui)
- build: 통과
- e2e: 통과 (192)

## 보류·후속 항목

- **W1 공유 패키지 추출**: file 검증 기본값 상수(+검증 로직 전체)의 런타임 중립 공유 패키지 승격은
  아키텍처 백로그 **B-1**(extractFormFields/validateFormSubmission 채널 중립 경로 승격)에 통합 추적.
  현 PR 은 spec §1 SoT + 양쪽 미러 JSDoc 동기화 의무로 마감.
- INFO#13(renderFileField 분리)·#14(파일 서빙 보안 정책)은 해당 surface 도입 시 처리.
