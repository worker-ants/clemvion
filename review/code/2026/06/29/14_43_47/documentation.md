# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `spec-area-index.test.ts` 주석에 `§4.2` 참조 추가 — 정확성 향상
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` L36-37
  - 상세: "This guard belongs to the §4.2 knowledge-base/plan-integrity family" 추가 및 SoT 참조를 `spec/conventions/spec-impl-evidence.md §4.2` 로 구체화. 변경된 섹션 번호가 실제 문서 구조와 일치하는지 확인 필요. 실제 `spec/conventions/spec-impl-evidence.md` 의 `§4.2` 절 제목이 "지식저장소·plan 무결성 가드" 임을 확인 — 참조 정확.
  - 제안: 이슈 없음. 주석이 변경된 코드와 문서를 정확히 반영.

- **[INFO]** `spec/conventions/spec-impl-evidence.md §1` blockquote — 제외 범위 경계가 이제 문서화됨
  - 위치: `spec/conventions/spec-impl-evidence.md` §1, 새로 추가된 blockquote
  - 상세: `spec/data-flow/**` 제외가 frontmatter-evidence 가드 한정임을 명시하고, §4.2 링크 무결성·area-index 가드는 data-flow 에도 적용됨을 본문에 설명. 이전에는 독자가 "data-flow 는 어떤 가드도 없다"고 오독할 수 있었던 위험이 해소됨. 설명이 구현(collectSpecMarkdown 범위, INCLUDE_PREFIXES 설정)과 일치함.
  - 제안: 이슈 없음.

- **[INFO]** `§2.1` `user_guide:` 필드 설명 확장 — 가드 미적용 명시 추가
  - 위치: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의 표
  - 상세: `user_guide:` 행에 "현재 build-time 가드 미적용 — 선언적 cross-link 전용이라 경로 오기는 빌드에서 검출되지 않음 (`code:`/`pending_plans:` 와 달리 §4 가드 대상 아님)" 설명이 추가됨. 독자가 필드 의미를 보는 시점에 가드 적용 여부를 즉시 알 수 있도록 인라인 문서화가 적절히 이루어짐.
  - 제안: 이슈 없음.

- **[INFO]** `§5.3` 예시 코드 업데이트 — `user_guide:` 로케일 쌍 예시 추가
  - 위치: `spec/conventions/spec-impl-evidence.md` §5.3 완성 머지 예시 블록
  - 상세: `user_guide:` 필드에 KO(`telegram.mdx`) + EN(`telegram.en.mdx`) 쌍을 모두 등재하는 예시가 추가됨. 주석 `# 선택 필드 — KO/EN 로케일 쌍 모두 등재 (§2.1)` 로 참조 연결. `telegram.en.mdx` 가 실제 경로에 존재함도 검증됨(consistency-check 에서 확인). 예시 코드가 §2.1 에 신설된 로케일 쌍 규약을 정확히 반영.
  - 제안: 이슈 없음.

- **[INFO]** `## Rationale` R-10 신설 — `user_guide:` 가드 미적용 근거 문서화
  - 위치: `spec/conventions/spec-impl-evidence.md` Rationale 섹션 끝
  - 상세: consistency-check 에서 Rationale 기록 누락(LOW)으로 지적된 항목이 R-10 으로 명문화됨. "선언적 cross-link 전용이라 stale 경로가 surface invariant 를 훼손하지 않으므로 build 차단 불필요", "기존 양방향 가드 중복 방지", "향후 가드 추가 시 진입 경로 명시" 세 가지 근거가 포함. 설계 결정이 Rationale 에 기록되지 않으면 독자가 "빠진 게 아닌가"로 오독할 수 있었던 위험이 해소됨.
  - 제안: 이슈 없음.

- **[INFO]** `user-guide-evidence.md` — `user_guide:` 로케일 쌍 등재 규칙 참조 미추가
  - 위치: `spec/conventions/user-guide-evidence.md` (본 PR 에서 미변경)
  - 상세: consistency-check INFO #2 에서 지적된 항목. `spec-impl-evidence.md §2.1` 에 신설된 `user_guide:` 로케일 쌍 등재 규칙이 `user-guide-evidence.md` 에 반영되지 않음. 빌드 가드 미적용이라 충돌은 없으나, 두 convention 문서 간 단방향 참조 누락. consistency-check 에서 "별건 후속으로 분리" 결정됨.
  - 제안: 별건 후속 작업으로 `user-guide-evidence.md` 에 "spec frontmatter `user_guide:` 의 로케일 쌍 등재 기준은 `spec-impl-evidence.md §2.1` 참조" 한 줄 추가 고려. 차단 사유는 아님.

## 요약

이번 변경은 순수 문서화 품질 향상 PR이다. `spec/data-flow/**` 의 frontmatter-evidence 제외 범위가 blockquote 로 명확히 기술되고, `user_guide:` 필드의 가드 미적용 이유가 §2.1 인라인 설명과 R-10 Rationale 양쪽에 동시 문서화됨으로써, 독자 오독을 예방하는 자기 완결적인 변경이다. 테스트 파일의 주석도 §4.2 참조를 추가해 정확성이 높아졌다. 유일한 후속 사항은 `user-guide-evidence.md` 동기화(INFO, 차단 아님)로, 이미 별건으로 분리 결정됨.

## 위험도

NONE
