# 문서화(Documentation) 리뷰

## 발견사항

### 1. 코드 파일 (loop.schema.ts, loop.handler.spec.ts, loop.schema.spec.ts)

- **[INFO]** `loop.schema.ts` — `validateLoopConfig` 함수 JSDoc 주석 내 stale 문장 잔존
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.ts` — `validateLoopConfig` 위 JSDoc 블록 (파일 컨텍스트 line ~800)
  - 상세: JSDoc 의 마지막 줄 "Single-field 'is count set?' check lives in `warningRules` below." 가 warningRule 제거 이후에도 그대로 남아 있다. warningRules 는 이제 `[]` 이므로 이 문장은 사실과 다르다.
  - 제안: 해당 줄을 "빈 값은 zod `default('1')` 이 미리 채우므로 handler 단에서 'count 미설정' 검사가 불필요하다." 로 교체하거나 삭제.

- **[INFO]** `loop.schema.ts` — `loopNodeMetadata` 의 SSOT 주석이 frontend mirror 언급을 유지하는지 미확인
  - 위치: `loopNodeMetadata` 블록 주석 "SSOT for warnings (frontend canvas + backend handler.validate)."
  - 상세: warningRules 가 빈 배열이 된 상황에서 "SSOT for warnings" 라는 표현은 의미를 잃는다. 프론트엔드 캔버스에서 이 배열을 읽어 배지를 렌더링하는 코드가 있다면 "빈 배열 = 배지 없음" 이 의도적 동작임을 주석에서 명시하지 않으면 추후 유지보수자가 의도인지 실수인지 구분하기 어렵다.
  - 제안: 주석을 "warningRules: [] — 빈 값 경로가 zod default 로 닫혀 있어 런타임 warningRule 불필요. 정책 상세: spec/4-nodes/1-logic/3-loop.md §8 Rationale." 로 교체.

- **[INFO]** `loop.handler.spec.ts` — 새 테스트 케이스 설명이 한·영 혼용
  - 위치: `loop.handler.spec.ts` line 383 (diff), it 블록 제목
  - 상세: `'accepts missing count — zod default("1") fills it ("최소 반복 1회" 정책, spec §8)'` 는 영문 it 설명 안에 한국어 정책 명칭을 삽입하는 혼용 형태다. 프로젝트 내 다른 it 설명은 영문만 사용하는 패턴이 지배적이다.
  - 제안: `'accepts missing count — zod default("1") fills it (min-1-iteration policy, spec §8)'` 처럼 영문으로 통일하거나, 한국어 명칭을 인라인 주석으로 분리.

- **[INFO]** `loop.schema.spec.ts` — warningRules 빈 배열 테스트가 정책 배경을 설명하나 spec 링크가 생략
  - 위치: `loop.schema.spec.ts` line 554–558 (diff)
  - 상세: 인라인 주석 "정책 배경: spec/4-nodes/1-logic/3-loop.md §8 Rationale 참고." 가 포함되어 있어 양호하다. 다만 `it` 설명 문자열 `'is intentionally empty — see spec §8 Rationale'` 은 spec 파일 경로 없이 `§8` 만 언급한다. 테스트를 처음 보는 기여자가 §8 이 어느 파일 §8 인지 즉시 알기 어렵다.
  - 제안: it 문자열을 `'is intentionally empty — see spec/4-nodes/1-logic/3-loop.md §8 Rationale'` 처럼 파일 경로를 포함시키거나, 위 인라인 주석이 이미 경로를 제공하므로 현행도 수용 가능.

---

### 2. frontend/backend-labels.ts

- **[INFO]** `backend-labels.ts` — 모듈 레벨 JSDoc 이 삭제 항목 동기화 정책을 언급하지 않음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 파일 최상단 JSDoc (line ~904)
  - 상세: 파일 JSDoc 은 "신규 검증 메시지를 추가할 때마다 영문 원문 → 한국어 매핑을 함께 등록한다." 고만 기술한다. warningRule 이 제거될 때 대응 `WARNING_KO` 항목도 **같은 PR** 에서 삭제해야 한다는 반대 방향 가이드가 없다. 이번 PR 은 올바르게 처리했지만, 문서가 없어 다음 유지보수 시 누락 위험이 있다.
  - 제안: JSDoc 에 "warningRule 이 제거되는 경우에도 해당 `WARNING_KO` 항목을 동일 PR 에서 함께 삭제한다 (i18n Principle 3)." 한 줄 추가.

---

### 3. plan/in-progress/loop-count-policy.md

- **[INFO]** plan 문서의 작업 항목에 spec 파일 링크가 상대 경로 없이 파일명만 언급
  - 위치: `plan/in-progress/loop-count-policy.md §작업 항목`
  - 상세: 작업 항목에서 `spec/4-nodes/1-logic/3-loop.md` 를 자주 언급하지만 일부 항목은 "L13", "L170" 처럼 줄 번호만 참조한다. 줄 번호는 코드 변경에 따라 밀릴 수 있어 오랜 시간 후 추적이 어렵다. 또한 plan 내에서 spec 파일로의 markdown 링크(하이퍼링크)가 없어 탐색 편의성이 낮다.
  - 제안: 줄 번호 참조 대신 섹션 번호(예: "§1 표의 count 행") 로 대체하고, 핵심 spec 파일은 `[3-loop.md](../spec/4-nodes/1-logic/3-loop.md)` 형태의 상대 링크로 연결.

- **[INFO]** plan 문서에 "최소 반복 1회 정책" 이 결정된 날짜와 결정자 정보가 부분적으로 존재하지만 근거 링크 미흡
  - 위치: `loop-count-policy.md §결정 (사용자, 2026-05-19)` 섹션
  - 상세: 결정 배경과 근거가 불릿으로 잘 서술되어 있으나, 이 결정의 원 논의를 담은 ai-review / consistency-check 보고서 링크가 "관련 문서" 섹션에만 있고 결정 섹션에서 직접 참조되지 않는다.
  - 제안: 결정 섹션 끝에 `(근거: ai-review SUMMARY W-1, consistency-check I-1)` 참조 한 줄 추가 — 독자가 결정 섹션만 읽고 근거를 찾을 수 있도록.

---

### 4. review 산출물 문서 (consistency check 결과 파일들)

- **[INFO]** `review/consistency/2026/05/19/07_35_34/plan_coherence.md` — 파일 최상단에 표준 헤더(검토 대상·검토 모드 메타)가 누락
  - 위치: `plan_coherence.md` 전체 파일 (diff 확인: `### 발견사항` 으로 바로 시작)
  - 상세: 같은 세션의 다른 checker 결과 파일(`cross_spec.md`, `convention_compliance.md`, `naming_collision.md`)은 모두 파일 최상단에 `# <제목>`, `검토 대상:`, `검토 모드:`, `검토 시각:` 메타 블록을 갖는다. `plan_coherence.md` 만 이 헤더가 없고 바로 `### 발견사항` 으로 시작해 세션 내 일관성이 깨진다.
  - 제안: `plan_coherence.md` 상단에 `# Plan Coherence 검토 — loop-count-policy plan` + 검토 대상/모드 메타 블록 추가.

---

### 5. CHANGELOG / README 업데이트 필요성

- **[INFO]** 이번 변경(loop count default 정책 + warningRule 제거)은 외부 API 변경이나 신규 환경변수를 수반하지 않아 README 업데이트는 불필요하다. CHANGELOG 를 관리하는 관례가 프로젝트에 없으므로 CHANGELOG 누락도 문제없다.
  - 위치: 프로젝트 루트 (README.md, CHANGELOG.md 부재 확인)
  - 상세: 정책 변경의 내용은 `plan/in-progress/loop-count-policy.md` 와 `spec/4-nodes/1-logic/3-loop.md §8 Rationale` 에 충분히 기록된다.
  - 제안: 없음.

---

## 요약

문서화 관점에서 이번 PR 은 전반적으로 양호하다. `loop.schema.ts` 의 인라인 주석이 정책 배경과 spec 참조를 명확히 기술하고 있으며, plan 문서도 결정 근거·작업 항목·후속 follow-up 을 구조적으로 서술한다. 주요 보완 포인트는 두 가지다. 첫째, `validateLoopConfig` JSDoc 의 stale 문장("Single-field 'is count set?' check lives in `warningRules` below.")이 warningRule 삭제 이후에도 남아 있어 코드와 주석이 불일치한다. 둘째, `backend-labels.ts` 모듈 JSDoc 이 "추가" 방향 동기화만 기술하고 "삭제" 방향 i18n Principle 3 요구사항을 명시하지 않아 향후 유사 작업 시 누락 위험이 있다. consistency check 결과 파일 중 `plan_coherence.md` 만 표준 헤더를 갖추지 않은 것도 세션 내 일관성 문제다. 이 세 건은 모두 INFO 수준이며 기능 동작에 영향을 주지 않는다.

## 위험도

LOW
