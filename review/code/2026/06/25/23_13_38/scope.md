### 발견사항

**[INFO] `Envelope` 타입 삭제 — 범위 내 정리**
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts`, `type Envelope` 제거 (6줄)
- 상세: `asEnvelope()` 헬퍼가 추가되면서 `Envelope` 타입이 불필요해져 제거됨. `to*` 함수 내부에서 `as Envelope` 캐스팅과 함께 사용하던 패턴 전체를 `asEnvelope()` 호출로 교체. 변경 의도(두 shape 통일 처리)의 직접 결과이므로 범위 내.

**[INFO] `toCarousel` — `itemButtons` 병합 기능이 노드 카루셀에도 적용**
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts`, `toCarousel()` 함수
- 상세: commit 메시지에 "(노드 카루셀도 개선)" 으로 명시. AI PresentationPayload 수정의 부수 효과로 기존 `{config, output}` envelope 카루셀에도 `itemButtons` 병합이 활성화됨. plan 문서 항목 4에도 "(노드 카루셀도 동일 개선.)"으로 명기되어 의도적 포함. 노드 카루셀에 `itemButtons` 필드가 없는 경우 `asButtons([])` = `[]` 로 안전하게 처리됨.

**[INFO] `toTemplate` — `content` fallback 키 추가가 노드 template 에도 영향**
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts`, `toTemplate()` 함수
- 상세: `output.content` fallback 추가로 노드 template 이 `rendered` 없이 `content` 필드를 갖는 경우에도 렌더됨. plan 항목 5에 명시("render-tool-provider 검증"). 기존 노드 template 은 `output.rendered` 를 사용하므로 실질 회귀 위험은 낮으나 범위는 AI path 외로도 확장됨.

**[INFO] plan 파일 신규 생성 — 규약 준수**
- 위치: `plan/in-progress/web-chat-ai-presentation-render.md` (신규 파일)
- 상세: CLAUDE.md 규약에 따라 진행 중 작업은 `plan/in-progress/<name>.md` 에 worktree 명시하여 생성. 변경 의도와 직접 연관된 문서화. 범위 내.

**[INFO] 테스트 파일 — 불필요한 회귀 케이스 없음**
- 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts`, 신규 `describe("PresentationPayload ...")` 블록
- 상세: 추가된 테스트 케이스(classifyPresentation 4종 + toCarousel + toTemplate + toTable/toChart + 회귀)는 모두 변경된 코드 경로를 커버. 기존 테스트는 수정 없음. 회귀 케이스(`{config,output}` envelope)도 버그 수정의 비파괴성 검증 목적으로 타당.

---

### 요약

변경 범위는 전반적으로 commit 메시지와 plan 문서에 선언된 의도와 일치한다. `presentation.ts` 의 수정은 (1) `asEnvelope` 헬퍼 신설, (2) `classifyPresentation` PresentationPayload 우선 경로, (3) `to*` 함수 내 `asEnvelope` 교체, (4) `toCarousel` itemButtons 병합, (5) `toTemplate` content fallback — 다섯 항목 모두 plan 에 명시된 사항이다. `Envelope` 타입 제거는 asEnvelope 도입의 자연스러운 정리이며 불필요한 리팩토링으로 볼 수 없다. `itemButtons` 병합과 `content` fallback 이 노드 카루셀/template 에도 적용되는 범위 확장이 있지만, 이는 plan 에 명시적으로 기재된 의도적 동작이다. 설정 파일·무관 파일 수정 없음. 포맷팅·임포트 변경 없음.

### 위험도

NONE
