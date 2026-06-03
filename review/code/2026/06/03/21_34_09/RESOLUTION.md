# RESOLUTION — ai-review 2026/06/03 21_34_09 (①②③④ 구현)

리뷰 결과: 0 Critical / 10 Warning / 23 Info (MEDIUM). 처리 disposition:

## WARNING

| # | 카테고리 | disposition |
|---|----------|-------------|
| 1 | SPEC-DRIFT ($itemIsFirst/Last spec 미갱신) | **false positive** — `foreach §3.3` + `expression-language §4` 표에 이미 추가됨, 마커 0, status implemented. 리뷰어가 code diff 만 보고 동일 커밋의 spec 변경을 놓침. 조치 없음 |
| 2 | SPEC-DRIFT (embedding §6.1 미갱신) | **false positive** — §6.1 이미 구현 상태로 교체, 마커 0, status implemented |
| 3 | SPEC-DRIFT (errorHandling spec 미갱신) | **false positive** — node-common §2.4/§2.5.1 이미 flip, config shape 명문화 완료 |
| 4 | SPEC-DRIFT (code summaryTemplate) | **false positive** — data-common §3 이미 `{{language\|upper}}` 로 갱신 |
| 5 | SPEC-DRIFT (template summaryTemplate) | **false positive** — presentation 0-common §6 표 단일 포맷으로 통일 완료 |
| 6 | 기능 버그 (use_default_output empty→null) | **fixed (spec 정합)** — 엔진은 `defaultOutput ?? null` 만 하고 §2.5.2 타입추론은 엔진·UI 모두 미구현이므로 empty→null 이 엔진 현실과 일치. spec §2.5.1/§2.5.2/§2.5.3 을 엔진 현실(`?? null` 폴백 + 타입추론 Planned)로 정정. null 저장은 의도된 동작 |
| 7 | 기능 버그 (빈 PDF 페이지 segment) | **fixed** — `parsePdfSegments` map 후 `filter(text.trim())` 로 빈 페이지 제거(페이지 번호 보존). 테스트 추가 |
| 8 | 테스트 격리 (zustand store 미리셋) | **fixed** — 패널 테스트 before/afterEach 에서 store 명시 리셋 |
| 9 | 테스트 커버리지 (다중 segment 미검증) | **fixed** — embedding.service.spec 에 다중 segment → embed 입력·chunkCount 검증 테스트 추가 |
| 10 | 부작용 (backend errorHandling 처리 확인) | **이미 충족** — 엔진 `getErrorPolicyConfig` 가 `config.errorHandling.policy` 를 읽음(이번 변경의 전제). 레거시 flat `errorPolicy` 는 엔진이 원래 읽지 않았고(기본 stop_workflow) 패널이 로드 시 마이그레이션하므로 런타임 오류 없음 |

## INFO (선별 처리)
- #19 빈 PDF 페이지 테스트 → #7 fix 와 함께 추가.
- 나머지 INFO(아키텍처 리팩토링 제안 #3~7·#10, 추가 엣지 테스트 #16~23, JSDoc #13~15 등)는 품질 개선 제안으로 후속 백로그. 기능/정합성 영향 없음 — 본 PR scope 밖.

## 검증
- backend: pdf.parser.spec / embedding.service.spec 15 pass, lint clean.
- frontend: settings-panel 109 pass, lint clean.
- 전체 TEST WORKFLOW (lint/unit/build) 는 직전에 통과 확인.

ESCALATE: 없음.
