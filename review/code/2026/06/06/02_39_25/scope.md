# 변경 범위(Scope) 리뷰

검토 대상: RAG 평가 하베스 P0 Phase 0+1 (rag-eval-harness)
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] ROOT_ENTITIES 분리 리팩토링 — 범위 판단 필요
- 위치: `codebase/backend/src/app.module.ts` + `codebase/backend/src/database/root-entities.ts` (신규)
- 상세: `app.module.ts` 에서 `ROOT_ENTITIES` 배열 전체(엔티티 임포트 30여 개 + export const)를 별도 파일 `src/database/root-entities.ts` 로 추출하고 `app.module.ts` 는 re-export 만 남겼다. plan 에 "EvalCliModule 이 app.module 전체를 transitive import 하지 않기 위해 ROOT_ENTITIES 를 별도 파일로 분리"라고 사유가 명시돼 있고, EvalCliModule 이 실제로 이 파일을 참조한다. 따라서 분리 동기는 이번 기능 구현의 필수 지원 변경으로 볼 수 있다. `app.module.ts` 에서 re-export(`export { ROOT_ENTITIES } from './database/root-entities'`)를 유지해 기존 import 사이트 호환이 유지되며 plan 은 "app.module.spec 회귀 없음"을 확인했다.
- 제안: 이 변경은 범위 내로 판단한다. 향후 유사 패턴에서 명시적 사유를 plan 에 기록하는 관행을 유지할 것.

### [INFO] review/consistency 디렉토리 산출물 커밋
- 위치: `review/consistency/2026/06/06/02_08_03/` 하위 5개 파일
- 상세: consistency-check 세션 산출물(SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json)이 diff 에 포함돼 있다. CLAUDE.md 정책상 `review/consistency/**` 는 정상 커밋 산출물 위치이다. 범위 이탈 없음.
- 제안: 조치 불필요.

### [INFO] plan Phase A/B 체크박스 미갱신
- 위치: `plan/in-progress/rag-eval-harness.md` §2 Phase A / Phase B 체크박스
- 상세: plan 본문 진행 노트에 "Phase A(코드)·B(spec) 구현 완료"라고 서술돼 있으나 모든 체크박스가 `[ ]` 로 남아 있다. 코드 변경 내용과 plan 체크박스 상태가 불일치한다. 범위 이탈은 아니나 plan 추적 정합성 사항이다.
- 제안: Phase A 완료 항목 체크박스를 `[x]` 로 갱신할 것.

### [INFO] generate-golden-set.ts 바이너리 diff
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: diff 에 `Binary files /dev/null and b/... differ` 로 표시됐다. 텍스트 파일이 바이너리로 감지된 경우로 파일 인코딩 문제(BOM 삽입 등) 가능성이 있다. 파일 내용을 직접 검토할 수 없어 범위 내 내용인지 확인 불가하다.
- 제안: 파일이 실제로 UTF-8 BOM 없이 저장됐는지 확인하고, 필요 시 `file` 또는 `hexdump` 명령으로 인코딩을 검증할 것.

---

## 요약

이번 변경은 plan `rag-eval-harness.md` 에 명시된 Phase A(코드) + Phase B(spec) 구현에 충실하게 대응한다. 신규 파일 전체(eval 타입·지표·CLI 모듈·스크립트·예시·README)가 plan 의 IN 범위 체크리스트와 1:1 대응하며, 기존 파일의 수정도 `app.module.ts` 의 ROOT_ENTITIES 분리와 `package.json` npm scripts 추가로 한정된다. ROOT_ENTITIES 분리는 EvalCliModule 의 경량 부트스트랩을 가능하게 하는 필수 지원 변경이며 plan 에 사유가 명시되어 있다. 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다. WARNING 1건은 사유 명시 관행 수준의 권고이며 차단 사항이 아니다.

---

## 위험도

LOW
