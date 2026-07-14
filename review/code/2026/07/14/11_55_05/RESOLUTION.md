# RESOLUTION — backend Dockerfile COPY 분리 (§4 item1) 리뷰 처분

세션: `review/code/2026/07/14/11_55_05` · reviewer 2종(dependency·side-effect) · **0 Critical / 0 Warning**
구현 커밋: `aec1edcf1`

## 조치 항목

Critical/Warning 0 — 수정 없음. 순수 build-cache 최적화이며 양 reviewer 가 closure 정확성·무-델타·가드 존재를 독립 재검증.

| # | 출처 | 등급 | 처분 |
|---|---|---|---|
| 1 | dependency / side_effect | INFO | 신규 backend 내부패키지 추가 시 Dockerfile COPY 수동 동기화 결합 → 기존 manifest COPY 리스트 패턴의 연장, 주석 경고 + prepare/builder 하드 실패 + CI docker build 게이트로 완화됨 → **조치 불요**(선택적: `codebase/backend/package.json` workspace deps ⊆ Dockerfile COPY 정적 가드 스크립트 — 향후 검토, 현 리스크 낮음). |

## TEST 결과
- **lint**: 통과
- **unit**: 통과 (14 suites)
- **build**: 통과 (docker backend+frontend + 위생 스모크; sdk/web-chat-sdk 소스 없이 frozen install·native·@workflow 4개 주입 정상)
- **e2e**: 통과 (253/253, 44 suites — backend-e2e deps/runner 스테이지가 변경을 exercise). 리뷰 후 코드 변경 없음 → 재수행 불요.

## 보류·후속 항목
- (선택) Dockerfile COPY 목록 vs backend workspace deps 정합 정적 가드 — 저우선 백로그.
