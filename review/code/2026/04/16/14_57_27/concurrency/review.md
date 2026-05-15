### 발견사항

- **[INFO]** 모듈 수준 가변 싱글톤 — `getDocsIndex`의 lazy init 패턴
  - 위치: `registry.ts` 마지막 블록 (`let cachedIndex: DocsIndex | null = null`)
  - 상세: `cachedIndex` 변수가 모듈 스코프에 `null`로 선언되어 있고, `getDocsIndex()` 호출 시 check-then-act 패턴으로 초기화됩니다. `loadDocsIndex`가 현재 동기(`fs.readFileSync`) 구현이므로 Node.js 단일 스레드 이벤트 루프에서는 실제 경쟁 조건이 발생하지 않습니다. 그러나 향후 `loadDocsIndex`를 비동기(`fs.promises.readFile`)로 전환하면, 첫 번째 `await` 이후 이벤트 루프가 양보되어 두 번째 호출이 `!cachedIndex` 검사를 통과하고 중복 초기화가 발생할 수 있습니다.
  - 제안: 현재 동기 구현을 유지하는 한 문제없습니다. 비동기 전환 시 Promise를 캐싱하도록 변경하세요:
    ```ts
    let indexPromise: Promise<DocsIndex> | null = null;
    export function getDocsIndex(): Promise<DocsIndex> {
      if (!indexPromise) indexPromise = loadDocsIndexAsync(...);
      return indexPromise;
    }
    ```

나머지 파일(MDX 픽스처, 테스트 파일, `mdx-components.tsx`, spec 문서)은 동시성과 무관합니다.

---

### 요약

변경된 코드 중 동시성 관점에서 주목할 부분은 `registry.ts`의 모듈 레벨 싱글톤 캐시(`cachedIndex`) 하나입니다. `loadDocsIndex`가 순수 동기 I/O로 구현되어 있어 현재 Node.js 환경에서는 경쟁 조건이 발생하지 않으며, Next.js SSR/RSC 요청이 동시에 유입되어도 안전합니다. 다만 이 패턴은 향후 비동기 I/O 전환 시 잠재적 경쟁 조건을 내포하므로, 변경 시 Promise 캐싱 패턴으로 마이그레이션할 것을 권고합니다.

### 위험도

**LOW**