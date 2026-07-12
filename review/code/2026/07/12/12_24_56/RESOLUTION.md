# RESOLUTION — review/code/2026/07/12/12_24_56

- 대상 리뷰: 위젯 disclaimer 예시·데모 기본값 문구 해요체 통일 (commit `40a375972`)
- 전체 위험도: **LOW** / Critical **0** / Warning **1**
- 처리자: main Claude (수동 조치)

## WARNING #1 (maintainability) — disclaimer 리터럴 4곳 중복, SSOT/drift 가드 부재

**위치**: `demo-config.ts:30`, `snippet.html:44`, `2-sdk.md:46` (+ canonical `web-chat-sdk.mdx:50`)

**결정: DEFER (범위 밖 — 후속 항목으로 이관, 본 PR 미수정)**

**근거**:
1. **본 diff 가 만든 결함이 아님.** 4곳 리터럴 중복은 이 변경 이전부터 존재하던 구조다. 오히려 본 diff 는 서로 달랐던 3곳 문구(합니다체/습니다체/truncated placeholder)를 canonical(`web-chat-sdk.mdx`)과 **byte 단위 일치**로 수렴시켜 기존 drift 를 줄였다 — 악화가 아니라 개선 방향이다.
2. **리뷰어 자체 판단도 "이번 PR 필수 아님, 후속 항목"** (SUMMARY 권장 조치사항 §1 및 maintainability WARNING 제안란에서 명시적으로 후속 제안).
3. **적정 수정이 별도 인프라 작업.** 4곳은 각각 TS 상수 / HTML 예제 / spec Markdown / MDX 로 언어·포맷이 달라 단일 `export` 상수로 통합할 수 없다. 실질 가드는 "4곳 리터럴 일치를 검증하는 경량 테스트(또는 `spec-link-integrity` 확장)" 신설이 필요하며, 이는 3줄 톤 정정 PR 의 스코프를 넘어선다.

**후속**: drift 가드(4곳 문자열 일치 검증) 신설을 별도 백로그 항목으로 이관 (background task 로 등록).

## INFO (조치 불요)

- **문체 통일 완결**: 저장소 전수 grep 결과 옛 문구 잔존 0건 — i18n-userguide Principle 6(해요체) 위반이 완결적으로 해소됨 (requirement·maintainability·documentation 공통 확인).
- `demo-config.test.ts` 는 disclaimer 기본값 문자열에 비결합(자체 override `" 주의 "` 사용) — 이번 diff 로 깨지는 테스트 없음.
- `widget-app.test.tsx:44,53` 의 잔존 합니다체는 footer 렌더 검증용 fixture(범위 밖, canonical SoT 미러 아님). channel-web-chat 은 hardcoded-korean 가드 스코프 밖.
- CHANGELOG 미기재는 순수 카피/톤 커밋에 대한 기존 프로젝트 관례와 부합(선례 `f718c6431`, `1902b4621`).

## 검증

- **TEST**: `tsc --noEmit` 0, channel-web-chat vitest **321/321** 통과.
- **consistency `--impl-done` (12_26_01)**: **BLOCK: NO** — 5/5 checker NONE/LOW (`plan_coherence` 는 disk-write 갭이라 journal 에서 복구, 결과 NONE 확인).
