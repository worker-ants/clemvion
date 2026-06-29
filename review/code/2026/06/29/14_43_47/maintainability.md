# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] spec-area-index.test.ts 주석 — 섹션 참조 추가로 가독성 향상
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 라인 36-37
- 상세: `// SoT: spec/conventions/spec-impl-evidence.md` 단일 라인에서 `§4.2` 계열 분류와 섹션 앵커를 명시한 두 줄로 개선됐다. 변경 자체는 긍정적이나, 해당 주석이 파일 상단 guard 설명 블록 내에 있어 구체적인 SoT 위치와 분류 맥락이 함께 제공되어 가독성이 높아졌다.
- 제안: 현행 수준으로 충분. 추가 조치 불필요.

### [INFO] spec/conventions/spec-impl-evidence.md 의 §1 blockquote — 단일 문단에 다중 책임
- 위치: `spec/conventions/spec-impl-evidence.md` 라인 1004 (diff +3줄 blockquote)
- 상세: 추가된 blockquote 는 세 가지 별개 정보를 단일 문장 흐름에 연결한다: (1) inclusive list 외 영역 = frontmatter-evidence 가드에서만 제외, (2) `spec/data-flow/**` 의 성격과 frontmatter 부재 이유, (3) §4.2 가드는 여전히 적용된다는 예외 명시, (4) 새 영역 추가 시 갱신 지점 안내. 하나의 blockquote 가 4가지 역할을 수행하다 보니 한국어 문장이 길고 중문이 연속된다. 문서가 아닌 코드라면 함수 분리를 권장할 복잡도지만, spec 산문 문서에서는 구조적 허용 범위 내다.
- 제안: 강제 사항 아님. 가독성 개선이 필요하다면 (1)~(2)와 (3)~(4)를 별도 blockquote 또는 불릿으로 분리하는 것을 향후 고려할 수 있다.

### [INFO] R-10 Rationale 항 — 구조는 일관적이나 인라인 bold 남발
- 위치: `spec/conventions/spec-impl-evidence.md` 라인 946-952 (R-10 신설)
- 상세: R-10 는 기존 R-1~R-9 과 동일한 `### R-N. 제목` 구조를 따르며 일관성 측면에서 문제없다. 다만 불릿 내 `**build-time 경로 실존 가드 대상이 아니다**`, `**선언적 cross-link**` 등 강조가 여러 곳에 산재해, 어느 부분이 핵심 판단인지 스캔 시 파악이 어렵다. 기존 R-9의 bold 패턴과 동일 수준이라 일관성은 유지됐으나, 전체 Rationale 섹션에 걸쳐 강조 남발 패턴이 축적되고 있다.
- 제안: 현행 유지 가능. 향후 Rationale 전체 리팩터 시 핵심 판단(decision) 1문장만 bold 로 남기고 나머지 이유(evidence)는 일반 텍스트로 통일하면 가독성이 개선된다.

### [INFO] review/ 산출물 JSON 파일 — 절대 경로 하드코딩
- 위치: `review/consistency/2026/06/29/14_34_29/_retry_state.json` 전체, `naming_collision.md` 라인 702
- 상세: `_retry_state.json` 의 `session_dir`, `prompt_file`, `output_file` 값이 `/Volumes/project/private/clemvion/.claude/worktrees/spec-dataflow-exclusion-note-08f8a5/...` 형태의 머신 절대 경로다. 이 파일은 워크트리 재시도 상태 관리용 ephemeral 파일이므로 다른 개발자 환경에서 재실행 시 경로 불일치가 발생한다. `naming_collision.md` 내에도 동일한 절대 경로가 인용됐다.
- 제안: `_retry_state.json` 는 워크트리 고유 ephemeral 파일로 용도상 문제없다. 단 `naming_collision.md` 같은 review 산출물 내 절대 경로 직접 인용은 상대 경로 또는 프로젝트 루트 기준 경로로 표기하는 것이 이식성 측면에서 낫다.

---

## 요약

이번 변경은 주로 spec 산문 문서 설명 보강(blockquote 추가·헤더 명료화·R-10 신설)과 테스트 파일 주석 개선, 일관성 검토 산출물 추가로 구성된다. 유지보수성 관점에서 실질적 위험은 없다. TypeScript 테스트 파일(`spec-area-index.test.ts`)의 변경은 2줄 주석 추가에 불과하며 기존 패턴과 완전히 일치한다. `spec/conventions/spec-impl-evidence.md`의 §1 blockquote는 한 문단에 역할이 집중돼 다소 긴 문장 흐름을 갖지만, spec 산문으로서 허용 범위 내이며 정보 밀도 대비 가독성은 양호하다. R-10 Rationale 신설도 기존 구조와 일관적이다. 전반적으로 변경이 코드베이스의 유지보수성을 낮추지 않으며, 오히려 기존에 암묵적으로 운영되던 data-flow 제외 결정과 `user_guide:` 가드 미적용 근거를 명문화함으로써 향후 기여자의 혼란을 줄이는 방향이다.

---

## 위험도

NONE
