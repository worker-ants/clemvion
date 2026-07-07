# Rationale 연속성 검토 — spec/2-navigation/13-user-guide.md

## 발견사항

- **[INFO]** IA 재편 커밋에서 "Tool Area" 재도입이 있었으나 동일 세션 내 즉시 정정됨 (현재 HEAD 는 정합)
  - target 위치: `spec/2-navigation/13-user-guide.md` §2 IA 트리, `03-workflow-editor/containers-and-tools` 행
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md §12` ("⚠ 재작성 예정 (현재 제거됨)" — AI Agent Tool Area 캔버스 드래그 인터랙션·`toolNodeIds`/`toolOverrides` config 필드는 제거됨), `spec/4-nodes/3-ai/1-ai-agent.md §4`, `spec/4-nodes/_product-overview.md` ND-AG-10 (제거됨 표기)
  - 상세: 커밋 `d7d920ef1` (워크플로우 에디터 가이드 8종 신규)이 처음 작성될 때 `containers-and-tools` 행 설명에 "AI Agent Tool Area" 문구가 그대로 들어가 이미 제거된 기능을 다시 노출하는 형태였다. 이는 같은 날 후속 커밋 `aaacb1701` (ai-review 정합 fix)에서 "AI Agent 도구 (설정 패널 기반 도구 연결)"로 정정되었고, 02-nodes/ai·99-faq·mcp-servers 등 다른 페이지의 잔여 Tool Area 서술도 함께 정리됐다. **현재 target(HEAD) 상태는 이미 정합** — 새 위반이 아니라 과거에 이미 자체 교정된 이력.
  - 제안: 조치 불필요. 다만 "제거된 기능(Planned/재작성 예정)" 관련 신규 페이지·섹션을 작성할 때 `0-canvas.md §12`, `1-ai-agent.md §1/§4`, `4-nodes/_product-overview.md` ND-AG-10 의 "제거됨" 마커를 작성 전 대조하는 체크리스트 항목화를 권장 (재발 방지).

- **[INFO]** 모바일 breakpoint 예외(R-1)가 양방향으로 잘 정합되어 있음 — 참고용 확인
  - target 위치: `spec/2-navigation/13-user-guide.md §10` 표 "모바일 진입" 행 + `## Rationale R-1`
  - 과거 결정 출처: `spec/2-navigation/_layout.md` (글로벌 사이드바 breakpoint 표, "< 1280px 숨김·햄버거" 원칙) + `spec/0-overview.md §3.4` 인접 cross-cutting 서술
  - 상세: target 은 글로벌 사이드바 원칙(1280px)과 다른 breakpoint(1024px, lg)를 `/docs` 내부 보조 네비에 적용하면서, 이를 새 Rationale(R-1)로 명시하고 `_layout.md` 쪽에도 "본 표는 전역 chrome 에만 적용, `/docs` 는 별도 근거" 라는 역참조 각주를 두어 두 문서가 서로를 인용한다(`_layout.md` L103, `0-overview.md` L325). 원칙 위반이 아니라 명시적으로 협상된 예외이며 새 Rationale 이 함께 작성된 모범 사례.
  - 제안: 조치 불필요.

## 요약

target(`spec/2-navigation/13-user-guide.md`)은 성격상 다른 2-navigation 영역 문서(대시보드·워크플로우 목록·트리거·스케줄·통합·인증 흐름 등)와 도메인이 겹치지 않아, 그쪽 Rationale 발췌(태그 필터 하향, Cafe24 연결 테스트 endpoint 전환, attention 가상 필터, isActive 편집 경로 등)와는 직접적 충돌 지점이 없다. target 자체가 인용하는 선행 결정 — 글로벌 사이드바 breakpoint 예외(`_layout.md`)와 AI Agent Tool Area 제거(`0-canvas.md §12`) — 는 모두 target 본문·frontier 커밋 이력에서 정합하게 반영되어 있으며, 특히 Tool Area 관련 표현은 최초 작성 시 잠깐 재도입됐다가 같은 날 후속 커밋으로 자체 교정된 것이 git 이력으로 확인된다(새로운 위반 아님, 이미 해소됨). 명시적으로 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례는 발견되지 않았다.

## 위험도

NONE
