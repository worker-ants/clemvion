# 정식 규약 준수 검토 결과

**대상 문서**: `spec/conventions/spec-impl-evidence.md` (worktree: `spec-userguide-convention-clarify-2c6e7d`)
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-29

---

## 발견사항

### 1. [INFO] `user_guide` 필드 정의에 KO/EN 로케일 쌍 등재 규칙 추가됨 — 대응 build-time 가드 없음
- **target 위치**: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의 표 (line 78) 및 §5.3 예시 (line 171–173)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §4 Build-time 가드 — 4건 목록 안에 `user_guide:` 경로 실존 검증 가드가 없음
- **상세**: 워크트리 변경으로 `user_guide` 필드 정의에 "가이드가 KO/EN 양쪽으로 존재하면 로케일 쌍(`<name>.mdx` + `<name>.en.mdx`)을 모두 등재" 규칙이 추가됐고, §5.3 예시에도 `.en.mdx` 경로가 신규 등재됐다. 그러나 이 `user_guide:` 경로들의 실존 검증을 담당하는 build-time 가드가 §4 어디에도 명시돼 있지 않다. `spec-frontmatter-parse.ts` 가 `user_guide?: string[]` 를 타입으로 파싱하지만, `spec-code-paths.test.ts`(code: 경로 매치 의무)나 별도 가드가 `user_guide` 경로 실존을 검증하는지 본 문서에서 명시되지 않는다. 새 등재 규칙이 실효적 강제 없이 선언만 된 상태다.
- **제안**: (a) `user_guide:` 경로의 실존 검증을 담당하는 가드가 이미 존재한다면(예: `registry.test.ts` 역방향, 또는 전용 가드), §4 또는 §4.1 관계 절에 명시한다. (b) 가드가 없다면 "user_guide 경로는 현재 가드 미적용" 임을 §2.1 또는 §4.1 에 명확히 기술해, 작성자가 경로를 잘못 적어도 빌드로 검출되지 않음을 인지하게 한다. (c) 중장기적으로 `spec-frontmatter.test.ts` 또는 별도 가드에서 `user_guide:` 경로 실존을 검증하고 §4 표에 추가하는 방향이 규약의 일관성에 부합한다.

### 2. [INFO] §5.3 완성 머지 예시의 `user_guide` 코멘트와 §2.1 정의 표현 사이의 미묘한 불일치
- **target 위치**: `spec/conventions/spec-impl-evidence.md` §5.3 (line 171) 인라인 코멘트 vs §2.1 표 (line 78)
- **위반 규약**: 직접 위반은 아니나 내부 일관성 문제
- **상세**: §2.1 표에서 `user_guide` 필드 의미는 "가이드가 KO/EN 양쪽으로 존재하면 로케일 쌍을 모두 등재 — §5.3 예시" 로 기술돼 있고, §5.3 예시의 인라인 코멘트는 `# KO/EN 양쪽 존재 시 로케일 쌍 모두 등재` 다. 두 표현은 동일 의미지만 "양쪽으로 존재하면"(§2.1)과 "양쪽 존재 시"(§5.3) 로 표기가 미묘하게 다른 이중 선언이다. 의미 충돌은 없으나, §2.1 이 SoT 이고 §5.3 은 예시이므로 §5.3 코멘트는 "§2.1 참조" 수준으로 단순화하거나 §2.1 표현과 완전히 동일하게 맞추면 중복 정의를 제거할 수 있다.
- **제안**: §5.3 코멘트를 `# 선택 필드 — KO/EN 양쪽 존재 시 로케일 쌍 모두 등재 (§2.1)` 처럼 §2.1 을 명시적으로 가리키게 수정하거나, 두 표현을 동일 문구로 통일한다. 단, 현재 상태도 기능적 오해를 일으키지 않으므로 INFO 등급.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 워크트리 변경본은 전반적으로 정식 규약 구조(frontmatter `id`/`status`/`code:` 스키마, Overview/본문/Rationale 3섹션, `spec/conventions/` 위치, kebab-case id, 5-enum status 라이프사이클, build-time 가드 표, Rationale 절별 근거)를 충실히 준수하고 있다. CRITICAL 또는 WARNING 등급 위반은 발견되지 않는다. 다만 이번 변경에서 추가된 `user_guide` 로케일 쌍 등재 규칙(§2.1, §5.3)이 대응 build-time 가드 없이 선언만 된 상태로, 가드 유무 또는 미적용 사실을 본문에 명시해두면 실수를 줄일 수 있다(INFO).

---

## 위험도

LOW
