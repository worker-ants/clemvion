# Testing 리뷰

## 발견사항

- **[INFO]** 변경 범위의 성격상 테스트 추가 의무 없음 — 문서 전용 변경
  - 위치: 파일 1~8 (`.mdx` 파일 전체)
  - 상세: 이번 변경은 `frontend/src/content/docs/**` 아래의 MDX 사용자 가이드 파일 수정에 집중되어 있다. MDX 콘텐츠 자체는 텍스트 콘텐츠이므로 단위 테스트 대상이 아니며, 이는 정상적인 문서 작업 패턴이다.
  - 제안: 해당 없음.

- **[WARNING]** plan 문서가 주장하는 "spec/code 경로 실존 검증" 테스트가 실제로 존재하지 않음
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` 체크리스트 — "테스트 — `registry.ts` 단위 테스트에서 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존을 검증함"
  - 상세: `frontend/src/lib/docs/__tests__/registry.test.ts`를 전체 검토한 결과, `spec` 또는 `code` 프론트매터 필드에 기재된 파일 경로가 실제로 디스크에 존재하는지 검증하는 테스트 케이스가 없다. `assertFrontmatter()` 함수도 `spec`/`code` 배열을 파싱만 할 뿐 경로 실존을 확인하지 않는다(`registry.ts` L17–18: `spec?: string[]`, `code?: string[]`로 선언만 되어 있고 존재 여부 검증 코드 없음). fixture `b.mdx`에 `spec: ["spec/0-overview.md"]`가 포함되어 있으나, 이것이 실제 경로로 존재하는지 테스트하는 assertion은 없다. 이번 변경에서 `integrations.mdx`에 `spec/4-nodes/4-integration/4-cafe24.md`와 `backend/src/nodes/integration/cafe24/cafe24.schema.ts`가 새로 추가되었고, `ai.mdx`에도 `spec/conventions/conversation-thread.md`가 추가되었는데, 이들 경로가 실제로 존재하는지 자동으로 검증되는 경로가 없다. plan 문서의 해당 체크박스는 미달성 상태인 것으로 보인다.
  - 제안: `registry.test.ts`에 실제 docs 루트를 대상으로 모든 `.mdx` 파일의 `spec`/`code` 프론트매터 경로 실존을 검사하는 테스트를 추가한다. 예시:
    ```ts
    it("frontmatter spec/code 경로가 실제 파일로 존재해요", () => {
      const repoRoot = path.resolve(__dirname, "../../../../../../..");
      const realIndex = loadDocsIndex(
        path.resolve(repoRoot, "frontend/src/content/docs"),
      );
      for (const section of realIndex.sections) {
        for (const page of section.pages) {
          for (const ref of page.frontmatter.spec ?? []) {
            const abs = path.resolve(repoRoot, ref);
            expect(fs.existsSync(abs), `spec path '${ref}' in ${page.filePath} does not exist`).toBe(true);
          }
          for (const ref of page.frontmatter.code ?? []) {
            const abs = path.resolve(repoRoot, ref);
            expect(fs.existsSync(abs), `code path '${ref}' in ${page.filePath} does not exist`).toBe(true);
          }
        }
      }
    });
    ```

- **[INFO]** 신규 필드(`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)의 기존 백엔드 단위 테스트 커버리지는 충분함
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts`, `backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts`
  - 상세: `ai-agent.schema.spec.ts`는 `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread` 기본값을 명시적으로 검증한다(L22–29). `ai-agent.thread.spec.ts`는 `contextScope='thread'` messages/system_text 모드, `contextScope='lastN'`, `excludeFromConversationThread`, `includeToolTurns` 동작을 각각 독립적인 it 블록으로 커버한다. 문서가 기술한 동작 계약과 실제 테스트 대상 로직이 일치한다.
  - 제안: 해당 없음.

- **[INFO]** `$thread` 변수 관련 표현식 해석기 테스트 커버리지 양호
  - 위치: `backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` L394–507
  - 상세: `$thread.turns`, `$thread.length`, `$thread.text` 노출 여부, `text`의 지연 평가 및 메모이제이션, 빈 thread 처리 등 문서에 기술된 주요 접근 패턴을 모두 단위 테스트로 커버하고 있다. 문서에서 언급한 `{{ $thread.turns[0].data.email }}` 패턴 중 `data` 속성에 대한 직접 접근 테스트는 없으나, `turns` 배열의 구조를 통한 간접 커버는 이루어지고 있다.
  - 제안: 필요하다면 `$thread.turns[0].data.*` 형태의 중첩 접근 표현식 테스트를 한 케이스 추가하면 문서 예시와의 완전한 대응이 가능하다.

- **[INFO]** Cafe24 노드 관련 백엔드 테스트 기존에 존재함
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts`, `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`, `backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts`
  - 상세: 이번 변경은 Cafe24 노드의 사용자 가이드 문서를 추가한 것이며, 구현 자체는 이미 존재하고 테스트도 갖추고 있다. 신규 테스트 작성 의무가 없다.
  - 제안: 해당 없음.

- **[INFO]** 프론트엔드 e2e 테스트에서 docs 페이지를 직접 방문하는 시나리오 없음
  - 위치: `frontend/e2e/` 전체
  - 상세: 현재 e2e 스펙에 `/docs/02-nodes/ai`, `/docs/02-nodes/integrations`, `/docs/04-expression-language/variables-and-context` 등 변경된 페이지를 직접 렌더링하고 콘텐츠를 확인하는 테스트가 없다. docs 페이지 렌더링은 콘텐츠 오류(잘못된 MDX 문법, 컴포넌트 파라미터 오타 등)를 빌드 타임에만 잡을 수 있는 구조이므로, 이 자체가 즉각적인 문제는 아니다.
  - 제안: 중요 docs 페이지에 대한 smoke e2e 테스트(예: 각 페이지 200 응답 및 핵심 헤딩 존재 확인)를 장기적으로 추가하면 회귀 감지력이 높아진다. 현재 PR 범위에서 필수는 아니다.

## 요약

이번 변경의 주된 내용은 MDX 문서 갱신으로, 실제 테스트 코드의 변경이 없는 순수 문서 작업이다. 변경된 기능(contextScope 계열 필드, `$thread` 변수, Cafe24 노드)에 대한 백엔드 단위 테스트는 기존에 이미 충분한 수준으로 존재하며, 문서에 기술된 동작 계약과 잘 대응된다. 다만 한 가지 실질적인 문제가 있다: plan 문서가 "registry.ts 단위 테스트에서 spec/code 경로 실존을 검증함"이라고 완료 처리했으나, 해당 테스트가 실제로 존재하지 않는다. 이번 변경에서 `integrations.mdx`와 `ai.mdx`에 새 spec/code 경로가 추가되었고, 이 경로들이 실제 파일 시스템에 존재하는지는 자동으로 검증되지 않는다. 이 갭을 registry.test.ts에서 채우는 것을 권고한다.

## 위험도

LOW
