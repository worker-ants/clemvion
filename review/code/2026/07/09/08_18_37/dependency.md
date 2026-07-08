# 의존성(Dependency) 리뷰

## 대상

커밋 `6248480` — `refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치`
(파일 1~11: CHANGELOG.md, workspace-store.ts, href.test.ts, href.ts, resolve-fallback.ts, RESOLUTION.md, spec 문서 5건)

### 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: 전체 diff (`package.json`/`pnpm-lock.yaml` 변경 없음)
  - 상세: 이번 커밋은 순수 내부 리팩터(정규화 로직 강화 + 헬퍼 위임)와 spec/CHANGELOG 문서 갱신뿐이다. `workspace-store.ts`/`href.ts`/`resolve-fallback.ts`/`href.test.ts` 에서 사용된 심볼(`zustand`, `zustand/middleware`, `vitest`)은 모두 기존에 이미 사용 중이던 의존성이며 신규 import 대상이 아니다. 버전 고정·라이선스·취약점·번들 크기·호환성 관점에서 검토할 대상이 없다.
  - 제안: 해당 없음(조치 불요).

- **[INFO]** 내부 모듈 의존 관계 변경 — `workspace-store.ts` → `resolve-fallback.ts` 신규 런타임 의존 추가
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:414` (`import { resolveFallbackWorkspace } from "@/lib/workspace/resolve-fallback"`), `codebase/frontend/src/lib/workspace/resolve-fallback.ts:1` (`import type { WorkspaceSummary } from "@/lib/stores/workspace-store"`)
  - 상세: `workspace-store.ts` 의 `setWorkspaces` 인라인 폴백 로직(현재 id 유지/첫 항목 폴백)이 `resolveFallbackWorkspace` 로 위임되면서, 두 파일 사이에 A(store)→B(resolve-fallback) 런타임 의존과 B→A 타입 전용(`import type`) 의존이 동시에 존재하는 구조가 됐다. 커밋 메시지가 이를 "type-only import 라 런타임 순환 없음"으로 명시하고 있고, 실제로 `resolve-fallback.ts` 쪽 import 가 `import type` 키워드를 사용해 컴파일 시 완전히 지워지므로 런타임 순환 의존(circular runtime dependency)은 발생하지 않는다 — 검증 결과 이 주장은 코드와 일치한다. 대신 이번 변경으로 `[slug]` layout 폴백 리다이렉트·`(main)/[...rest]` catch-all·`workspace-store.setWorkspaces` 세 소비처가 `resolveFallbackWorkspace` 라는 단일 내부 유틸에 수렴해, 정책 변경 시 단일 지점만 고치면 되는 방향으로 결합도가 개선됐다(DRY, 중복 제거).
  - 제안: 조치 불요 — 향후 `resolve-fallback.ts` 에 `workspace-store.ts` 로부터의 값(런타임) import 가 추가되는 변경이 생기면 그때는 실제 순환이 되므로 재검토가 필요하다는 점만 주의 표시.

- **[INFO]** `href.ts` 정규식 강화는 런타임 의존 변화 없음
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:687-689`
  - 상세: backslash/제어문자(tab/CR/LF) 정규화 추가는 순수 문자열 처리 로직 확장이며 외부 라이브러리(예: URL 파싱 라이브러리) 도입 없이 정규식만으로 구현되어 있다. 의존성 관점에서는 중립.
  - 제안: 해당 없음.

### 요약

이번 커밋은 슬러그 라우팅 기능의 2차 보완(round-2) 커밋으로, 신규 외부 패키지 추가·버전 변경·`package.json`/lockfile 수정이 전혀 없어 버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 해당 사항이 없다. 유일한 의존성 관련 변화는 프론트엔드 내부 모듈 간 결합으로, `workspace-store.ts` 가 기존 `resolve-fallback.ts` 의 `resolveFallbackWorkspace` 를 재사용하도록 위임하면서 3곳의 인라인 폴백 로직을 단일 진실로 수렴시켰다. 두 파일 간 상호 참조(값 import + type-only import)는 커밋 메시지의 주장대로 런타임 순환을 유발하지 않음을 확인했으며, 오히려 유지보수성을 개선하는 정당한 리팩터다. 의존성 관점에서 이 변경에 대한 조치 사항은 없다.

### 위험도

NONE
