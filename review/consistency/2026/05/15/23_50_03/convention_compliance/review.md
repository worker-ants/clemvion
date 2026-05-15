# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-15

---

## 발견사항

### [INFO] plan 문서에 체크박스 대신 번호 목록으로 후속 단계 기술
- target 위치: `## 검토 후 단계` 섹션 (lines 98-103)
- 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — "미체크 체크박스(`[ ]`), 'TODO', '남은 작업', '다음 단계', '결정 필요', 미해결 follow-up 항목이 하나라도 있으면 `in-progress/` 다"
- 상세: `## 검토 후 단계` 의 1~4 항목이 번호 목록으로 작성되어 있다. 이 문서는 현재 `plan/in-progress/` 에 있고, 이들 항목은 아직 완료되지 않은 후속 단계다. CLAUDE.md 의 분류 기준에서 `[ ]` 체크박스 형식을 권장하는 것은 "완료 여부를 식별 가능하게" 하기 위함이다. 번호 목록은 완료 상태를 추적할 수 없어, `complete/` 이동 판단 근거가 모호해진다.
- 제안: 번호 목록을 `[ ]` 체크박스로 교체한다. 예: `1. ...` → `- [ ] ...`. 각 단계가 완료되면 `- [x]` 로 변경해 완료 추적을 명확히 한다.

### [INFO] `## 배경` 섹션에 흡수 대상 plan 파일 참조 — 해당 plan 파일의 상태 미언급
- target 위치: `## 배경` 섹션 line 33 — `plan/in-progress/spec-update-embedding-pipeline-consistency.md` 참조
- 위반 규약: `CLAUDE.md` §정보 저장 위치(단일 진실 원칙) — plan 문서는 최신 상태를 반영해야 한다
- 상세: 배경 설명에서 "본 draft 로 흡수한다"고 언급하지만, 흡수 후 원본 plan 파일(`spec-update-embedding-pipeline-consistency.md`)을 어떻게 처리할 것인지(삭제, `complete/` 이동, 항목 체크 등)에 대한 기술이 없다. `## 검토 후 단계` 3번 항목에서 갱신 언급이 있으나, 이 두 plan 파일의 관계와 생명주기 처리가 한 곳에서 명확히 드러나지 않는다.
- 제안: 배경 또는 검토 후 단계에 "원본 plan(`spec-update-embedding-pipeline-consistency.md`)의 처리 방식 — 항목 이관 완료 후 `complete/`로 `git mv`" 을 명시적으로 기술한다. 이미 3번 항목에 일부 언급이 있으므로 해당 항목을 구체화("갱신 후 complete/ 이동")해도 충분하다.

### [WARNING] spec 변경 제안에서 `## 1. 개요` → `## Overview` 변경이 규약 패턴과 일치하나, 연쇄 영향 미명시
- target 위치: `### 1. spec/5-system/8-embedding-pipeline.md` 변경 표 첫 행 (line 55)
- 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성(Overview / 본문 / Rationale)을 따른다"
- 상세: `## 1. 개요` 를 `## Overview` 로 변경하는 것은 CLAUDE.md 권장 패턴에 부합한다. 그러나 해당 spec 파일 내 다른 섹션 헤더들(예: `## 2. ...`, `## 3. ...` 등 현재 숫자-prefix 섹션)도 함께 규약에 맞춰 정비가 필요한지 본 draft 에서 명시하지 않는다. 만약 `§8 WebSocket 알림` 등 섹션이 여전히 숫자 prefix 체계를 유지한다면, `## Overview` 만 단독 변경되어 헤더 스타일이 혼재(숫자 prefix vs 의미 명칭)하게 된다. 이는 spec 문서의 내부 일관성 문제를 낳을 수 있다.
- 제안: spec draft 에 "이번 편집 범위에서 전체 섹션 헤더 정비는 범위 외(보수적 접근)"라는 명시적 결정을 기록하거나, 또는 헤더 정비 범위를 확장해 전체 섹션 헤더를 의미 명칭으로 통일하는 작업을 후속 항목으로 추가한다. 현재 상태로는 이 선택이 의도적인지 누락인지 판단하기 어렵다.

---

## 준수 확인 사항 (위반 없음)

다음 항목은 정식 규약을 준수하고 있다:

1. **plan 파일 위치**: `plan/in-progress/` — 올바른 위치.
2. **plan 파일 명명**: 평문(plain name), 숫자 prefix 없음 — plan 파일에는 숫자 prefix 가 적용되지 않으므로 정상.
3. **frontmatter 구성**: `worktree`, `started`, `owner` 세 필드 모두 정상 기재.
4. **금지 경로 신규 생성 없음**: `prd/`, `memory/`, `user_memo/` 경로로의 신규 문서 생성 없음. 오히려 spec 의 옛 경로 참조(`memory/kb-embedding-model-selection.md`, `review/2026-05-02_13-18-24/`)를 제거하는 방향으로 정비를 제안하고 있어 규약 방향과 일치한다.
5. **review 경로 신규 생성 없음**: 본 draft 자체가 nested ISO 경로(`review/consistency/2026/05/15/...`)로 처리되고 있으며, 옛 flat 경로를 신규 생성하지 않는다.
6. **`## Rationale 섹션 정리` 변경 지침**: CLAUDE.md 의 "Rationale = 결정의 배경·근거·폐기된 대안" 원칙에 맞게 작업 일지 형식 헤더를 결정 중심으로 변경하는 방향을 명시하고 있다. 정보 손실 금지도 명기되어 있다.
7. **Node output·API 형식**: 본 draft 는 WebSocket 이벤트 타입과 채널 명명 변경을 제안하나, `spec/conventions/node-output.md` 의 Principle 규칙(Output 구조, error 컨트랙트 등)을 직접 위반하는 내용은 없다. WebSocket 이벤트는 node output convention 적용 대상이 아닌 서버-클라이언트 프로토콜 레이어다.
8. **Cafe24 API metadata convention 해당 없음**: 본 draft 는 Cafe24 관련 변경을 포함하지 않아 `spec/conventions/cafe24-api-metadata.md` 적용 대상이 아니다.
9. **migration 명명 규약**: `spec/1-data-model.md` §2.12.1 변경에서 V022/V023 마이그레이션을 참조하고 있으며, `spec/conventions/migrations.md` 의 `V<번호>__<snake_case_descriptor>` 패턴을 직접 도입하거나 위반하는 내용이 없다(참조만 함).

---

## 요약

target 문서(`plan/in-progress/spec-draft-embedding-pipeline-consistency.md`)는 전반적으로 정식 규약을 준수하고 있다. frontmatter 구성·파일 위치·명명 컨벤션은 모두 올바르다. 옛 금지 경로(`memory/`, `review/<flat-timestamp>/`)를 신규 생성하는 일도 없으며, 오히려 spec 에서 해당 참조를 제거하는 방향을 제안해 규약 방향과 일치한다. 발견된 CRITICAL 위반은 없다. WARNING 1건은 spec 헤더 스타일 혼재 가능성에 대한 선택적 명시 누락이며, 의도적 보수 접근이라면 한 줄 결정 기록으로 해소된다. INFO 2건은 체크박스 미사용과 흡수 대상 plan 파일 처리 미명시로, 운영 추적성에 영향을 주는 소규모 개선 사항이다.

---

## 위험도

LOW
