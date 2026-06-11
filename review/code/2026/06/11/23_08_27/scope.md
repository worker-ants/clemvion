# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 범위 내 추가 기능 — 차원 자동 감지 UI(read-only 필드, 힌트 텍스트)
- 위치: `codebase/frontend/src/components/models/model-config-form-dialog.tsx`, `dimensionAutoDetected` 로직 및 `<p>` 힌트
- 상세: 버그 픽스(embedding 설정 `testConnection` 실패)를 넘어 "감지된 차원을 폼에 read-only로 표시하고 힌트 문구를 보여주는" UI 기능이 추가됐다. 엄밀히는 요청 범위를 약간 초과하나, probe embed 결과를 사용자에게 자연스럽게 피드백하기 위한 최소 확장으로 볼 수 있다. over-engineering 수준은 아니며, i18n 키(`dimensionAutoHint`, `dimensionManualHint`)와 UI 변경이 일관되게 묶여 있어 산개 없음.
- 제안: 의도적 확장으로 판단하면 수용 가능. 범위를 픽스에만 한정해야 한다면 read-only 표시와 힌트 추가는 후속 태스크로 분리 가능.

### [INFO] 범위 내 추가 기능 — 차원 자동 저장(`modelConfigsApi.update` 호출)
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx`, `testMutation.onSuccess`
- 상세: 연결 테스트 성공 시 감지된 `dimension`을 서버에 자동 persist 하는 로직이 추가됐다. 버그 픽스의 직접 범위는 "testConnection이 embedding 설정에 대해 실패하던 것을 고친다"이고, 차원 자동 저장은 그 위에 더해진 편의 기능이다. 단, 이 기능은 probe embed 결과(`dimension`)를 의미 있게 활용하기 위한 자연스러운 연결로, 차원 필드를 probe 반환값으로 채운다는 설계 의도(PR 타이틀 `fix-embedding-test-dimension`)에 포함된다고 볼 수 있다.
- 제안: PR 의도(dimension 감지 포함)라면 범위 내로 수용 가능. 단, `testMutation`의 `mutationFn` 인자 타입을 `id: string`에서 `config: ModelConfigData` 전체로 변경한 것은 자동 저장 로직에 `config.dimension` 비교가 필요해서 불가피한 변경으로, 범위 이탈 아님.

### [INFO] 무관한 변경 없음 — 임포트·포맷팅·설정 파일 정상
- 위치: 전체 diff
- 상세: 불필요한 임포트 추가/삭제, 의미 없는 공백·줄바꿈 변경, 설정 파일(tsconfig, eslint, jest.config 등) 수정이 없다. 변경된 파일 모두 embedding testConnection 회귀 수정과 직결된다.
- 제안: 해당 없음.

### [INFO] 리뷰 산출물 파일 다수 포함 — `review/code/2026/06/11/21_48_12/` 하위
- 위치: 파일 11~21 (RESOLUTION.md, SUMMARY.md, api_contract.md, architecture.md, concurrency.md, documentation.md, maintainability.md, meta.json, _resolution_log.md, _resolution_state.json, _retry_state.json)
- 상세: 이전 리뷰 사이클의 산출물과 resolution 파일들이 동일 커밋에 포함돼 있다. 이들은 코드 변경과 무관한 관리 파일이나, 프로젝트 규약상 `review/code/**` 디렉터리에 기록하는 것이 정상 워크플로이므로 규약 위반이 아니다.
- 제안: 범위 이탈이 아님. 다만 코드 변경과 review 산출물 커밋을 분리하면 히스토리 추적이 더 명확해진다.

### [INFO] `plan/in-progress/spec-update-embedding-testconnection.md` 신규 생성
- 위치: 파일 10
- 상세: SPEC-DRIFT 후속 조치를 위한 plan 파일이 포함됐다. 개발자 역할 범위에서 spec 변경 위임 draft를 plan에 기록하는 것은 규약 허용 범위(`plan/**` 쓰기 권한)이다.
- 제안: 이상 없음.

## 요약

이번 변경의 핵심은 embedding 설정에 대한 `testConnection`/`listModels`가 `kind='chat'` 고정 조회로 인해 `MODEL_CONFIG_NOT_FOUND`를 반환하던 회귀를 수정하는 것이다. 수정 범위는 명확하게 그 목적에 집중돼 있으며, 불필요한 리팩토링·무관 파일 수정·임포트 정리·포맷팅 혼입은 없다. 추가된 기능(probe embed 결과 `dimension` 반환, 프론트엔드 자동 저장, read-only 힌트 UI)은 PR 타이틀(`fix-embedding-test-dimension`)이 시사하는 "차원 감지" 설계 의도 안에 있으므로 over-engineering보다는 연계 완성도 확보로 판단된다. 리뷰 산출물 파일(21개 중 11개)이 코드 diff에 포함된 점은 프로젝트 규약상 정상이나 코드/리뷰 커밋 분리를 고려할 수 있다.

## 위험도

NONE

STATUS: SUCCESS
