# Rationale 연속성 검토 결과

대상: `spec/7-channel-web-chat/1-widget-app.md` (impl-done, diff-base=origin/main)
diff 범위: `codebase/channel-web-chat/src/lib/presentation.ts` / `presentation.test.ts` /
`widget/components/presentations.tsx` / `presentations.test.tsx` — table 잘림 배너에 `totalCount`
(잘리기 전 총 행 개수) 투영·노출.

## 발견사항

없음. CRITICAL/WARNING/INFO 어느 등급도 발견되지 않았다.

### 확인한 근거

1. **R8("presentation 렌더 — 두 shape 통일 수용 + 복원 범위의 실제 경계")과의 정합** — target 문서
   `spec/7-channel-web-chat/1-widget-app.md §Rationale R8`(라인 185-198)은 이미 "총 개수
   (`{itemsTotalCount|rowsTotalCount}`, 잘리기 전 총 개수)도 흡수돼 table 잘림 배너에 함께 노출된다
   (메인 편집기 run-results parity) — 흡수만 하고 소비하지 않으면 죽은 필드가 된다" 를 명문화하고 있다.
   diff 는 정확히 이 서술대로 `TableData.totalCount` 필드 추가·`toTable()` 의 `output.rowsTotalCount`
   투영·`TableView` 배너의 총 개수 노출을 구현한다. 결정 재도입·원칙 위반 없음.

2. **Rationale 이 코드보다 먼저 갱신됨(정상 SDD 순서)** — `git log` 확인 결과 해당 R8 문구 자체가
   커밋 `4e1f665fc "docs(spec): 웹채팅 위젯 table 잘림 배너 총 개수 노출 (§2/R8, parity)"` 에서
   **먼저** 추가됐고(§2 표 L48 + §Rationale R8 갱신), 그 다음 구현 커밋
   `f72a08963 "feat(web-chat): table 잘림 배너 총 개수 노출 (§2/R8 parity)"` 과
   `20489126d "refactor(web-chat): ai-review Warning 3건 조치"` 가 뒤따랐다. "결정을 뒤집으면서 새
   Rationale 없이" 류의 무근거 번복 패턴이 아니라, planner 가 Rationale 을 갱신한 뒤 developer 가
   구현한 정상적 spec-first 흐름이다.

3. **carousel 제외 caveat 준수** — R8 은 "carousel 은 잘림 배너 자체가 미구현이라 총 개수 노출도
   별도 후속으로 추적한다" 고 명시 범위를 좁혀 뒀다. diff 는 실제로 `toCarousel`/carousel 렌더러를
   건드리지 않고 table 경로에만 한정돼 있어 이 범위 제약과 어긋나지 않는다.

4. **방어적 파싱 스타일과의 일관성** — `presentation.ts` 는 기존에도 모든 필드(`columns`, `rows`,
   `chartType`, `outputFormat` 등)를 `typeof`/화이트리스트 기반 ad-hoc 파싱으로 처리하며 별도 스키마
   라이브러리를 쓰지 않는다(파일 헤더 주석: "zod schema SoT" 는 백엔드 발행측 표기일 뿐, 위젯 소비측은
   방어적 shape 추론). 신규 `totalCount` 검증(`typeof === "number" && Number.isFinite && >= 0`)도 동일
   패턴이라 새로운 검증 철학을 도입하지 않는다 — 오히려 "신뢰 못 할 total 을 배너에 흘리지 않는다"는
   XSS 방어(`isSafeUrl`)와 같은 결의 보수적 태도를 연장한 것으로 기존 합의 원칙과 일치한다.

5. **문체(해요체) 변경도 회귀가 아님** — "일부 행만 표시됩니다." → "일부 행만 표시돼요." 변경은
   `spec/conventions/i18n-userguide.md §Principle 6`("UI 사용자 가시 한국어 문자열은 ... 해요체로
   통일, `~합니다` 금지")과의 정합 방향이며, 커밋 로그(`20489126d` INFO9)에 따르면 이미 consistency-check
   사이클에서 지적·반영된 항목이다. 새로 도입된 불일치가 아니다.

6. **다른 spec 문서(0-overview·1-data-model·2-navigation/* 등)의 Rationale** 발췌분은 이번 diff 의
   코드 영역(channel-web-chat presentation 렌더러)과 직접 연관된 결정·invariant 를 포함하지 않아
   충돌 여지가 없다(payload 배포에 참고용으로 첨부된 것으로 판단, target 범위 밖).

## 요약

target diff 는 spec `1-widget-app.md §Rationale R8` 이 사전에 명시한 결정("총 개수도 흡수·노출, 죽은
필드 해소, table-only, carousel 은 별도 후속")을 그대로 구현한 것으로, 기각된 대안의 재도입·합의 원칙
위반·무근거 결정 번복·invariant 우회 중 어느 것도 발견되지 않았다. 오히려 spec(Rationale) 선갱신 →
구현 후속이라는 이상적인 SDD 순서를 보여주는 사례다.

## 위험도

NONE
