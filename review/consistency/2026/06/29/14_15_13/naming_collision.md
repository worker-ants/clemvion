# 신규 식별자 충돌 검토 결과

대상 파일: `spec/conventions/spec-impl-evidence.md`

## 변경 요약

본 diff 는 두 곳만 수정한다.

1. §2.1 필드 정의 표의 `user_guide` 행 설명에 "가이드가 KO/EN 양쪽으로 존재하면 로케일 쌍 (`<name>.mdx` + `<name>.en.mdx`) 을 모두 등재 — §5.3 예시" 문구 추가.
2. §5.3 예시 YAML 블록에 주석(`# KO/EN 양쪽 존재 시 로케일 쌍 모두 등재`)과 경로 항목(`telegram.en.mdx`) 추가.

새로 도입된 식별자는 다음 범주에서 검토했다.

---

## 발견사항

충돌에 해당하는 발견사항이 없다.

### 참고 사항 (정상 확인)

- **`user_guide` 필드 키**: `spec/conventions/spec-impl-evidence.md §2.1` 에 이미 정의된 기존 선택 필드다. diff 는 필드 자체를 신설하지 않고 설명 문구만 보완했다. `user_guide-evidence.md`, `spec-frontmatter-parse.ts` (`SpecFrontmatter.user_guide?: string[]`), `telegram.md`·`discord.md`·`slack.md` 에서 동일 키가 동일 의미로 사용 중이며 충돌 없다.

- **`telegram.en.mdx` 경로**: diff 가 §5.3 예시에 추가한 경로는 이미 `spec/4-nodes/7-trigger/providers/telegram.md` 의 `user_guide:` 목록에 동일 형태로 등재되어 있으며, 실제 파일 `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` 도 존재한다. 신규 식별자가 아니라 기존 경로의 예시 재활용이다.

- **§5.3 내부 참조**: `user_guide` 행에 추가된 `— §5.3 예시` 는 동일 문서 내 이미 존재하는 절(line 161)을 가리킨다. 새 앵커·섹션 번호를 도입하지 않는다.

- **요구사항 ID / API endpoint / 이벤트명 / ENV var / 파일 경로 / 설정 키**: diff 범위 내에 해당 유형의 신규 식별자가 없다.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 이번 변경은 기존 `user_guide` 필드 정의의 설명 보완과 §5.3 예시 YAML 보강에 한정된다. 새로 도입된 식별자(ID, 필드 키, 파일 경로 등)는 없으며, 추가된 경로(`telegram.en.mdx`)와 필드명(`user_guide`)은 이미 코드베이스와 타 spec 파일에서 동일 의미로 사용 중이므로 충돌이 존재하지 않는다.

## 위험도

NONE
