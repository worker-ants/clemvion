# Code Review 통합 보고서

## 전체 위험도
**LOW** — 7개 reviewer 모두 CRITICAL/WARNING 발견 없음. 이전 리뷰(14_43_25)의 W-1(SPEC-DRIFT)/W-2/W-3 전원 해소 확인. 잔여 발견사항은 모두 INFO 수준의 가독성·테스트 보완 권고.

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `loading=true, disabled=false` 조합에서 `<input>` 이 비활성화되지 않음을 단위 테스트가 명시적으로 문서화하지 않음. 현재 계약(타이핑 가능·전송 차단)의 의도 여부가 테스트만으로 불명. | `composer.test.tsx` 테스트 2 | 테스트 2에 `expect(screen.getByLabelText("메시지 입력")).not.toBeDisabled()` 추가로 현재 계약을 명시화하거나, `loading=true` 시 input 도 비활성화할지 API 설계 결정 후 반영. |
| 2 | 테스트 | `loading=true + disabled=true` 동시 적용 케이스가 `Composer` 단위 테스트에 없음. Panel 통합 테스트가 커버하나 단위 레벨 회귀망 없음. | `composer.test.tsx` 전체 | `render(<Composer loading disabled onSend={vi.fn()} />)` 케이스 추가해 스피너·aria-label·aria-busy·input disabled 동시 성립 확인. |
| 3 | 테스트 | `fireEvent.change`/`fireEvent.submit` 사용 — 실제 브라우저 이벤트 체인 생략. 현재는 무해하나 향후 IME/composition 이벤트 의존 로직 추가 시 오검증 통과 가능. | `composer.test.tsx` L52–55, L65–67 | 신규 테스트부터 `@testing-library/user-event` 사용. 기존 `panel.test.tsx` 도 점진적 마이그레이션 고려. |
| 4 | 테스트·유지보수 | `.wc-composer-spinner` CSS 클래스명 직접 조회 — 클래스명 변경 시 테스트만 깨지는 false-negative 위험. `aria-hidden="true"` 로 역할 기반 조회 불가하므로 클래스 조회가 현재 최선이나 결합도 존재. | `composer.test.tsx` L46, `panel.test.tsx` L303/L319 | 장기적으로 `<span data-testid="wc-composer-spinner">` 추가 후 `getByTestId` 로 교체해 클래스명 리팩터링 내성 확보. |
| 5 | 테스트 | CSS 변경(`opacity:.4` → `#c7cad1`, `[aria-busy="true"]:disabled` 브랜드 컬러, `@keyframes wc-spin`)이 jsdom 환경에서 검증 불가 — 선택자 오타·스타일 오류가 빌드 시점 미발견 가능. | `styles.ts` 전체 | 단기 조치 없음. 장기적으로 `widgetStyles` 스냅샷 테스트 및 시각 회귀 테스트(Chromatic/Percy) 도입 고려. |
| 6 | 유지보수 | `panel.tsx` 인라인 로딩 판정 `phase === "booting" \|\| phase === "streaming"` 이 JSX 속성에 직접 위치. 동일 파일의 `isEnded`, `fresh` 변수 추출 패턴과 불일치. | `panel.tsx` Composer loading prop 라인 | `const isAiProcessing = phase === "booting" \|\| phase === "streaming";` 추출 후 `loading={isAiProcessing}` 참조. phase 추가 시 수정 지점 집중화. |
| 7 | 유지보수 | `aria-busy={loading \|\| undefined}` — `false` 대신 `undefined` 로 attribute 미방출하는 React 관례를 코드만으로 즉시 파악하기 어려움. | `composer.tsx` button 엘리먼트 | 인라인 주석 추가 또는 `aria-busy={loading ? "true" : undefined}` 로 의도 명시화. 기능 동일. |
| 8 | 문서화 | `ComposerProps.placeholder`·`onSend` 에 JSDoc 없음. `loading`·`disabled` 에는 추가되어 인터페이스 내 문서화 수준이 불균일. | `composer.tsx` `ComposerProps` 인터페이스 | `/** 입력창 placeholder 텍스트. */` 및 `/** 전송 시 호출. */` 한 줄씩 추가로 동등 수준 맞춤. |
| 9 | 문서화 | `spec/7-channel-web-chat/1-widget-app.md §2` 갱신 여부를 리뷰 대상 diff에서 직접 확인 불가. plan 문서는 갱신 완료를 선언하나 별도 커밋에 포함되었거나 누락 가능성 병존. | `plan/complete/web-chat-composer-loading-indicator.md` | merge 전 `spec/7-channel-web-chat/1-widget-app.md §2` "입력창" 행에 aria-busy·스피너·중립 회색 기술이 실제 포함되었는지 `git log` 확인. (requirement reviewer는 해당 spec 갱신 완료 확인함 — 커밋 포함 여부 재확인 권고.) |
| 10 | 부작용 | `aria-label` 이 `loading` 상태에 따라 "전송" ↔ "AI 응답 중" 으로 전환됨. 외부 e2e가 항상 "전송" 라벨로 선택 시 `loading=true` 구간 선택 실패 가능. 현재 단위/통합 테스트는 올바르게 처리됨. | `composer.tsx` button aria-label | e2e 테스트가 있는 경우 phase별 라벨 선택 분기 여부 확인. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 XSS/인젝션 표면 없음. CSS iframe 격리. 시크릿 없음. |
| requirement | NONE | 이전 W-1(SPEC-DRIFT)/W-2/W-3 전원 해소. spec §2 ↔ 구현 line-level 일치. |
| scope | NONE | 모든 변경이 선언된 의도(스피너 + 중립 회색 UX) 범위 내. |
| side_effect | LOW | aria-label 동적 전환으로 인한 e2e 선택자 잠재 영향(현재 테스트는 정상 처리). |
| maintainability | NONE | INFO 수준 가독성 권고(isAiProcessing 추출, aria-busy 명시화). |
| testing | LOW | loading=true+disabled=false 입력 상태 미문서화, fireEvent 대신 userEvent 권장. |
| documentation | LOW | placeholder/onSend JSDoc 누락, spec diff 미확인. |

## 발견 없는 에이전트

모든 에이전트가 발견사항을 보고했으나 전원 INFO 수준. CRITICAL·WARNING 발견 에이전트 없음.

## 권장 조치사항

1. (선택적) `composer.test.tsx`에 `loading=true, disabled=false` 조합 input 상태 명시 케이스 및 `loading=true + disabled=true` 동시 케이스 추가해 현재 API 계약 문서화 (INFO #1, #2).
2. (선택적) `panel.tsx`에 `const isAiProcessing = ...` 변수 추출해 기존 코드 패턴과 일관성 맞춤 (INFO #6).
3. (선택적) `ComposerProps.placeholder`·`onSend` JSDoc 한 줄 추가 (INFO #8).
4. (확인 필요) merge 전 `spec/7-channel-web-chat/1-widget-app.md §2` 갱신이 실제 커밋에 포함되어 있는지 `git log` 확인 (INFO #9).
5. (장기) 신규 테스트부터 `@testing-library/user-event` 사용, 스피너 `data-testid` 추가, CSS 스냅샷 테스트 도입 검토 (INFO #3, #4, #5).

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행(강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전원 router_safety 강제 포함)
- **제외**: 아래 표 (7명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 reviewer)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 제외 (pure UI prop 추가, 성능 민감 변경 없음으로 판단) |
| architecture | 라우터 제외 (컴포넌트 구조 변경 없음) |
| dependency | 라우터 제외 (신규 패키지 의존성 없음) |
| database | 라우터 제외 (DB 변경 없음) |
| concurrency | 라우터 제외 (비동기/동시성 변경 없음) |
| api_contract | 라우터 제외 (외부 API 계약 변경 없음) |
| user_guide_sync | 라우터 제외 (사용자 가이드 영향 없음으로 판단) |