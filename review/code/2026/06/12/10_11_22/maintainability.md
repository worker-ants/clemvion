### 발견사항

#### Spec 문서 변경 (파일 12-19)

- **[INFO]** `spec/1-data-model.md`: 구현 상태 주석(괄호 안 inline 서술)이 단일 문단에 집적되어 가독성 부담 증가
  - 위치: diff 라인 `> **구현 상태**: ...` 블록 (line 389)
  - 상세: 변경 전/후 모두 V088~V094 마이그레이션 히스토리를 한 줄 블록쿼트에 압축해 서술하는 패턴이 유지된다. 변경 후 텍스트가 더 길어져 (PR4b 은퇴 설명 추가) 가독성이 소폭 저하된다. 그러나 이 블록쿼트는 해당 테이블의 구현 상태 요약으로 기존 패턴을 일관되게 따르고 있으며, 내용 자체는 명확하다.
  - 제안: 현재 패턴 유지는 수용 가능. 마이그레이션 이력이 더 늘어날 경우 별도 Rationale 하위 목록으로 분리 고려.

- **[INFO]** `spec/1-data-model.md`: `embedding_model_config_id` 컬럼 설명이 두 문장 이상의 복합 서술로 길어짐
  - 위치: diff 라인 `| embedding_model_config_id | UUID? | FK → ModelConfig ...` (line 380)
  - 상세: 변경 전에는 legacy 컬럼 2행으로 분산됐던 정보가 변경 후 단일 셀에 집적되었다. `(V091)` 레퍼런스, `embeddingModel` 파생 캐시 설명, NULL 시 폴백 경로까지 한 셀에 담겨 있어 테이블 셀 가독성이 다소 떨어진다.
  - 제안: `embeddingModel` read-only 파생 캐시 설명은 테이블 아래 별도 주석이나 단락으로 분리하는 것이 테이블 스캔 가독성에 유리하다. 테이블 셀은 1-2 문장 이내 유지 권장.

- **[INFO]** `spec/5-system/3-error-handling.md`: 신설 `## Rationale` 섹션의 위치가 파일 말미
  - 위치: diff 라인 `## Rationale` ~ 끝 (line 1447-1453)
  - 상세: `3-error-handling.md` 의 기존 구조가 Overview / 본문 카탈로그 순이고, Rationale 이 파일 최하단에 추가됐다. CLAUDE.md 규약(Overview / 본문 / Rationale 3섹션)과 일치하며 패턴 준수. Rationale 내용도 변경 근거를 명확히 서술한다.
  - 제안: 없음 — 구조 일관성 준수.

- **[INFO]** `spec/conventions/error-codes.md`: `§3` 하단 인라인 블록쿼트 경계 주석이 `## 4. Rename 이력` 앞에 삽입됨
  - 위치: diff 라인 `> §3 은 **부정확한 이름이나 *유지*되는 active 코드**...` (line 1580)
  - 상세: §3 테이블 직후에 §3 vs §4 목적 구분을 인라인 블록쿼트로 삽입했다. 독자가 §3 을 다 읽은 뒤 §4 로 넘어가기 직전에 구분 맥락을 제공하는 위치 선택은 적절하다. 단, 이 블록쿼트는 §3 의 부분인지 §4 의 서문인지 시각적으로 모호하다.
  - 제안: 이 블록쿼트를 `## 4. Rename 이력` 섹션의 첫 번째 문단 앞에 배치하거나, `## 3.` 섹션 소개 문단으로 이동해 섹션 귀속을 명확히 한다.

- **[WARNING]** `spec/conventions/error-codes.md`: `§4` 테이블에 `PR` 컬럼 값이 `PR4b` 로만 기재되어 PR 번호가 미결
  - 위치: diff 라인 `| LLM_CONFIG_NOT_FOUND | ... | PR4b | ...` (line 1588-1589)
  - 상세: `PR` 컬럼에 실제 GitHub PR 번호 없이 `PR4b` 코드명만 기재되어 있다. 이 이력 테이블의 유지보수 목적(rename 배경 추적)에 비춰 볼 때, 실제 PR 번호 없이는 향후 히스토리 추적이 어렵다. cross_spec 리뷰도 동일 지적을 담고 있다.
  - 제안: PR 머지 후 실제 PR 번호를 채운다. merge 전 단계라면 `(PR4b, #TBD)` 또는 placeholder 표기를 추가해 미입력 상태임을 명시한다.

- **[INFO]** `spec/5-system/7-llm-client.md`: 에러코드 4개 위치 중 3개가 이번 diff 에서 `MODEL_CONFIG_INVALID` 로 갱신됨 — line 341 의 에러 처리 표도 함께 갱신되어 일관성 확보
  - 위치: diff line 235, 257, 327, 341 (모두 갱신 완료)
  - 상세: 이번 PR 에서 `7-llm-client.md` 의 4개 위치가 모두 치환됐다. 이전 일관성 검토에서 경고했던 "4개 위치 미갱신" 문제가 해소됐음을 확인.
  - 제안: 없음 — 갱신 완료.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md`: 신설 Rationale 항 제목이 `### 결정: legacy 임베딩 폴백(step-3) 은퇴 (PR4b)` 로 `PR4b` 코드명 포함
  - 위치: diff 라인 `### 결정: legacy 임베딩 폴백(step-3) 은퇴 (PR4b)` (line 1557)
  - 상세: Rationale 헤딩에 PR 코드명을 포함하는 것은 본 프로젝트 기존 패턴(`## Rationale "결정: ..."` 형식)과 소폭 다르다. 다만 PR 코드명 포함이 히스토리 추적에 유용하다. 기존 Rationale 에 포함된 PR 코드 참조 패턴과 일관성을 유지하는 수준이다.
  - 제안: 현재 패턴 수용 가능. `(PR4b)` 를 제목 안 대신 제목 다음 줄 본문에 배치하면 헤딩이 더 간결해진다.

- **[INFO]** `spec/data-flow/6-knowledge-base.md`: `knowledge_base` 생성 컬럼 목록(sink 테이블 행)이 단일 셀에 장문으로 유지됨
  - 위치: diff line 1722
  - 상세: 변경 전후 모두 `knowledge_base` 생성 컬럼 목록이 단일 테이블 셀에 집적된 패턴이다. `embedding_model` 컬럼이 제거되어 오히려 이번 변경으로 셀이 조금 짧아졌다. 기존 패턴과 일관적이다.
  - 제안: 현행 패턴 유지.

#### Review 산출물 (파일 1-11)

- **[INFO]** `review/consistency/2026/06/12/09_01_10/_retry_state.json`: `agents_success: []`, `agents_fatal: []`, `agent_history: {}` 등 초기 상태 값이 그대로 커밋됨
  - 위치: diff line 517-521
  - 상세: 이 파일은 오케스트레이터 재시도 상태 추적용 내부 파일이다. 산출물 보관 목적으로 커밋됐으나 완료 후 상태가 아니라 초기(pending) 상태가 그대로 남아있다. 향후 이 파일을 참조하는 사람이 "에이전트가 실제 실행됐는가"를 파악하기 어렵다.
  - 제안: 오케스트레이터가 완료 후 최종 상태를 덮어쓰도록 하거나, 상태 파일을 `.gitignore` 에 추가해 산출물 폴더에서 제외한다. 현재는 review artifact 폴더에 포함되어 있어 혼선 가능성이 있다.

- **[INFO]** `review/consistency/2026/06/12/09_01_10/meta.json`: 파일 말미 개행 없음 (`\ No newline at end of file`)
  - 위치: diff line 933
  - 상세: `meta.json` 과 `_retry_state.json` 모두 파일 끝 개행 없음. JSON 파일로서 파싱에는 무해하지만, git diff 표기가 `\ No newline at end of file` 로 나타나 노이즈가 된다.
  - 제안: JSON 직렬화 시 `\n` 를 추가하거나 일관된 파일 포맷 설정(`.editorconfig` 등)을 적용한다.

---

### 요약

이번 변경은 주로 spec 문서의 legacy 컬럼 제거 반영, 에러코드 rename 소급, Rationale 신설로 구성된다. 코드(소스 파일)가 아닌 마크다운·JSON 산출물이 대상이므로 순환 복잡도나 함수 길이 등의 전통적 지표는 해당되지 않는다. 유지보수성 관점에서 주요 이슈는 두 가지다. 첫째, `spec/conventions/error-codes.md §4` Rename 이력 테이블의 `PR` 컬럼에 실제 PR 번호가 없어 향후 히스토리 추적이 불완전하다(WARNING). 둘째, `§3` 뒤 경계 주석의 섹션 귀속이 시각적으로 모호하다(INFO). 나머지 발견 사항은 기존 문서 패턴을 일관되게 따르고 있어 유지보수성 저하 위험이 낮다. spec 갱신의 의도와 범위는 명확하게 서술되어 있고, 이번 diff 에서 `7-llm-client.md` 의 4개 에러코드 위치가 모두 갱신되어 이전 일관성 검토 경고가 해소된 점은 긍정적이다.

### 위험도

LOW
