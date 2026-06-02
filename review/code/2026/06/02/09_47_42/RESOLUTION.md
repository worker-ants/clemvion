# RESOLUTION — web-chat-presentation-rich-ea5a59 (2026/06/02/09_47_42)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드/보안 | e1b6610a | `isSafeUrl` — `blob:` / `file:` 스킴 차단 추가; presentation.test.ts 에 테스트 추가 |
| W2 | 코드/보안 | e1b6610a | `TemplateView` — `safeHtml !== null && safeHtml.length > 0` 가드 추가; 빈 sanitize 결과 → plain text 폴백 |
| W3 | 문서 | e1b6610a | marked-before-DOMPurify = defense-in-depth 수용; safe-html.ts 주석 + RESOLUTION 기록 |
| W4 | 코드 | e1b6610a | `hookInstalled` 문서화 + `_resetHookForTest()` 테스트 격리 helper export |
| W5 | 테스트 | e1b6610a | `src/lib/safe-html.test.ts` 신설 — SSR null, text null, markdown typeof string 단언, XSS 제거, link hook, FORBID_TAGS, hookInstalled 멱등성 (11 tests) |
| W6 | 테스트 | e1b6610a | `_resetHookForTest()` + `afterEach` 로 hookInstalled 격리; safe-html.test.ts 전체 `afterEach` 처리 |
| W7 | 코드/보안 | e1b6610a | `renderTemplateHtml` — `typeof parsed !== "string"` 런타임 가드; Promise 시 null 반환 |
| W8 | 의존성 | e1b6610a | `dompurify` → `"3.4.7"`, `marked` → `"18.0.4"` exact 고정; `npm install` 으로 lock 동기화 |
| W9 | 의존성 | e1b6610a | `"engines": { "node": ">=20" }` 추가 |
| W10 | 문서화 | e1b6610a | `CartesianChart` 마진 — `CHART_MARGIN_LEFT/RIGHT/TOP/BOTTOM_*` 명명 상수 + 역할 주석 |
| W11 | 문서화 | e1b6610a | `README.md` "상태" 섹션 갱신 — rich presentation / safe-html / 차트 완료 기능 반영 |
| W12 | 문서화 | e1b6610a | `renderTemplateHtml` JSDoc — "클라이언트 전용(window 필수), SSR→null" 명시 |

## TEST 결과

- lint      : 통과
- typecheck : 통과
- test      : 통과 (112 passed, +20 new tests from 92 baseline)
- build     : 통과 (Next.js 16 static export — SSR guard verified green)
- e2e       : 면제 (화이트리스트: channel-web-chat 위젯 SPA — e2e 인프라 docker 기반, 해당 변경은 unit/build 게이트로 충분)

## 보류·후속 항목

### 수용·문서화 결정 (코드 변경 없음)

- **W3 / I1 / I2 / I3 수용**: marked-before-DOMPurify 순서는 표준 defense-in-depth (DOMPurify 가 최종 방어선). `USE_PROFILES: { html: true }` 는 DOMPurify 기본 안전 정책으로 수용; `ALLOWED_TAGS` 화이트리스트 전환은 미래 하드닝 옵션으로 주석 기록. `cellText` JSON.stringify 는 rows 가 백엔드 신뢰 데이터임을 safe-html.ts 주석에 기록.
- **I14**: `marked.parse as string` 이유 주석 — safe-html.ts 에 "marked.parse with async:false always returns string synchronously" 주석 추가 완료.
- **I19**: dompurify 듀얼 라이선스(MPL-2.0 OR Apache-2.0) — Apache-2.0 선택을 safe-html.ts 파일 상단 주석에 기록.
- **I20**: 변경 범위 이탈 없음 — 확인만.

### spec 위임 (project-planner 경유 필요)

- **I4 (spec 3-chart.md §4)**: `spec/4-nodes/6-presentation/3-chart.md` 의 "recharts" 참조를 "channel-web-chat 위젯은 inline SVG (번들 경량화)" 로 수정 필요.
  draft: `plan/in-progress/spec-fix-chart-inline-svg.md`
- **I15 (spec 5-template.md HTML sanitize caveat)**: `spec/4-nodes/6-presentation/5-template.md` 에 클라이언트측 DOMPurify sanitize 보충 노트 추가 필요.
  draft: `plan/in-progress/spec-fix-template-dompurify.md`

### Info 항목 추적

- I5: XSS 테스트 assertions — presentations.test.tsx 에서 script null 단언 non-conditional 화 완료.
- I6: axisLabel 빈 문자열 → undefined 테스트 — presentation.test.ts 에 추가 완료.
- I7: truncLabel 경계값 — presentations.test.tsx 에 컴포넌트 레벨 말줄임표 단언 추가 완료.
- I8: line/area 차트 테스트 — polyline/polygon/circle/tooltip 검증 완료.
- I9: donut 차트 테스트 — .wc-chart-pie-wrap + donut hole circle + aria-label 검증 완료.
- I10: FORBID_TAGS 테스트 — safe-html.test.ts(form/input/style) + presentations.test.tsx 완료.
- I11: CartesianChart 매직 넘버 → 명명 상수 완료.
- I12: PieSlices cx/cy/r → PIE_SVG_SIZE 파생 완료.
- I13: PieChart aria-label donut 동적 처리 완료.
- I16: yLabel JSDoc 추가 완료.
- I17: toChart JSDoc xLabel/yLabel 추출 동작 기술 완료.
- I18: presentations.tsx 상단 주석 safe-html 언급 완료.
- I19: Apache-2.0 선택 safe-html.ts 주석 기록 완료.

---

## main 후속 — spec escalation 종결 (cross-surface 구분, spec 변경 불요)

resolution-applier 가 ESCALATE=spec 로 올린 2건(Info#4 chart recharts, Info#15 template sanitize caveat)을
검토한 결과 **둘 다 spec-impl 불일치가 아니라 surface 혼동**이므로 4-nodes presentation spec 을 바꾸지 않는다.
speculative draft 2건 제거.

- **Info#4 (3-chart §4 recharts)**: 해당 spec(L114/138/227)의 "프런트엔드가 client-side recharts 로 그린다"는
  **메인 프론트엔드 에디터 run-results 렌더러**(`codebase/frontend/.../presentation-renderers.tsx`, 실제 recharts 사용)를
  기술한다. channel-web-chat **위젯은 별개 surface**(임베드 SPA)로, 번들 경량화를 위해 inline SVG 를 쓴다 —
  이는 위젯 spec(7-channel-web-chat) 영역의 구현 선택이며 4-nodes 차트 노드 계약과 무관하다. 4-nodes spec 을
  위젯 기준으로 고치면 메인 프론트 기술이 틀려진다. → spec 변경 불요.
- **Info#15 (5-template HTML sanitize caveat)**: spec 의 "output.rendered 는 sanitize 되지 않는다"는 **backend
  출력 계약**에 대한 정확한 서술이다. 위젯은 그 위에 **client-side DOMPurify** 를 추가하는 임베드 surface 의
  방어층(defense-in-depth)이며, 이는 위젯 구현 세부다. backend 계약 서술을 바꿀 필요 없다. 위젯의 inline 렌더는
  7-channel-web-chat §2("전체 타입 inline 렌더")가 이미 포괄한다. → spec 변경 불요.

(이의가 있으면 project-planner 가 7-channel-web-chat 에 위젯 렌더 tech 노트를 보탤 수 있으나 저비용·선택.)
