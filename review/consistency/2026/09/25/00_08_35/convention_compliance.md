# 정식 규약 준수 검토 — convention_compliance

## 컨텍스트

이번 `--impl-prep` 검토의 실제 구현 대상은 `docker-compose.yml` / `docker-compose.e2e.yml` /
`k8s/overlays/local/infra-minio.yaml` 의 MinIO 이미지 문자열 일치를 검증하는 harness 파이썬
테스트다 (`plan/in-progress/minio-image-parity-guard.md`, `spec_impact: none`). 이 작업은
`spec/` 를 전혀 쓰지 않는다. 그럼에도 스코프 번들러가 "MinIO" 키워드로 매칭한 기존 spec 두 문서
(`spec/0-overview.md` §2.7 Object Storage, `spec/data-flow/4-file-storage.md`)가 "구현 대상
영역"(target 문서)으로 제시되었다. 아래 발견사항은 이 두 **기존(standing) spec 문서**에 대한
것이며, 금번 PR 이 만들어낸 신규 위반이 아니다.

## 발견사항

- **[WARNING] 규약 번들 자체가 예산 초과로 검증에 필요한 규약을 대거 누락**
  - target 위치: 본 검토에 전달된 `_prompts/convention_compliance.md` 의 "정식 규약 모음
    (spec/conventions/)" 섹션 전체
  - 위반 규약: 없음(대상 문서 위반 아님) — 검토 프로세스 자체의 결함
  - 상세: `error-codes.md`(17,742자) · `swagger.md`(30,184자) · `spec-impl-evidence.md`
    (21,120자) · `migrations.md`(9,776자) · `node-output.md`(28,758자) · `redis-keys.md` ·
    `secret-store.md` · `node-cancellation.md` · `interaction-type-registry.md` 등 target
    문서와 직접 관련될 가능성이 높은 핵심 규약 문서가 전부 "컨텍스트 예산 초과로 본문 생략"
    처리됐다. 반면 target 문서와 무관한 `cafe24-api-catalog/`·`makeshop-api-catalog/` 하위의
    resource별 leaf 문서 (~250개 파일, `product/products__images.md` 류)는 전문이 그대로
    포함되어 예산을 먼저 소진했다. 그 결과 본 검토가 요구받은 5개 관점 중 "출력 포맷 규약"
    (에러 코드 명명, `INVALID_FILE_TYPE`/`FILE_REQUIRED`), "문서 구조 규약"(spec lifecycle
    frontmatter 의무 대상 여부), "API 문서 규약"(Swagger 패턴)을 target 문서에 대해 검증할
    근거 자료가 없다. 이는 기존 메모리 교훈("consistency `--spec` 기본 예산이 conventions 를
    통째로 떨군다")과 동일한 실패 클래스가 `--impl-prep` 경로에서도 재발한 것이다.
  - 제안: 번들 생성기가 (a) `spec/conventions/<name>-api-catalog/**/*.md` 형태의 leaf
    reference 문서(이미 `cafe24-api-catalog/_overview.md §7.1` 스스로 spec-impl-evidence
    frontmatter 의무에서 "제외"를 선언한 문서들)를 정식 규약 판단 자료에서 배제하거나 후순위로
    미루고, 짧고 target 과 관련성이 높은 규약 파일을 우선 포함하도록 예산 배분 순서를 바꿔야
    한다. 그전까지는 이 축에 대한 본 리포트의 PASS/FAIL 판단은 "미검증"으로 취급할 것.

- **[WARNING] `spec/0-overview.md` §8 "데이터 흐름" 행의 "알파벳 순 숫자 prefix" 서술이 사실과 다름**
  - target 위치: `spec/0-overview.md` §8 문서 맵 표, "데이터 흐름" 행 (`` `1-audit` ~ `15-external-interaction`, 알파벳 순 숫자 prefix ``)
  - 위반 규약: CLAUDE.md "문서 구조 규약" — 본 표는 `spec/data-flow/` 파일 명명 규칙을 스스로
    선언하는 자리이며, 명명 규칙 서술은 실제 파일 상태와 일치해야 한다.
  - 상세: 실제 `spec/data-flow/` 목록은 `1-audit → 12-workspace` 까지는 정확히 알파벳순
    (audit, auth, execution, file-storage, integration, knowledge-base, llm-usage,
    notifications, observability, triggers, workflow, workspace)이지만, 이후 추가된
    `13-agent-memory` · `14-chat-channel` · `15-external-interaction` 은 알파벳순이라면
    각각 1번대·앞쪽·중간에 와야 함에도 **도입 순서대로 끝에 append** 됐다 (`git log`로 확인:
    "알파벳 순 숫자 prefix" 문구는 12개 파일 시점 커밋 `a997eb721`에서 들어왔고, 세 파일을
    한 번에 추가한 `db496a3c2` 는 이 문구를 갱신하지 않았다). 즉 이 표는 더 이상 사실이 아닌
    명명 규칙을 계속 선언 중이다 — 다음에 data-flow 문서를 추가하는 사람이 "알파벳 순으로
    끼워 넣어야 하나, 다음 번호를 이어 붙여야 하나"를 이 표만 보고 잘못 판단할 수 있다.
  - 제안: "알파벳 순 숫자 prefix" 를 "도입 순 숫자 prefix (1~12는 우연히 알파벳순과 일치)"
    또는 단순히 "정수 prefix (도입 순, 재정렬하지 않음)" 로 정정한다. spec 변경이므로
    `project-planner` 소관.

- **[INFO] target 문서에 spec lifecycle frontmatter(`id`/`status`/`code`) 부재 — 예외 대상인지 미확인**
  - target 위치: `spec/0-overview.md`, `spec/data-flow/4-file-storage.md` 각 파일 최상단
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` (본 검토 번들에서 truncate 됨 —
    위 첫 WARNING 참조)
  - 상세: 두 문서 모두 YAML frontmatter 없이 `# 제목` 으로 바로 시작한다. 같은 번들에서
    전문이 보인 `spec/conventions/cafe24-api-catalog/category.md` 등은
    `id`/`status`/`code` frontmatter 를 갖추고 있어 대비된다. `spec-impl-evidence.md` 전문이
    없어 루트 cross-cutting 문서(`0-`/`1-`/`6-` prefix)와 `data-flow/` 문서가 이 의무의
    명시적 예외인지 이번 검토로 확정할 수 없다. (CLAUDE.md 표 자체는 루트 문서에 frontmatter
    를 요구한다는 언급이 없어 예외일 가능성이 높지만, SoT 는 spec-impl-evidence.md 다.)
  - 제안: `spec-impl-evidence.md` 를 온전히 포함한 재검토로 확정하거나, 두 문서가 이미
    안정적으로 운영 중인 기존 spec 임을 고려해 낮은 우선순위 후속 확인 항목으로만 남긴다.

- **[INFO] 이번 PR 과 target 문서의 무관성**
  - target 위치: N/A (스코프 자체)
  - 상세: 실제 diff 는 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`
    의 이미지 문자열과 `.claude/tests/test_minio_image_parity.py` 신설이며 `spec/` 변경은
    없다(`spec_impact: none`). 위 WARNING/INFO 는 모두 기존 standing spec 문서에 대한 것으로,
    이번 병합 여부를 막을 근거가 아니다.

## 요약

이번 작업(`minio-image-parity-guard`)은 harness 전용이며 `spec/` 를 건드리지 않으므로, 금번 PR
자체가 새로 만들어낸 정식 규약 위반은 없다. 다만 "MinIO" 키워드로 함께 번들된 기존 spec 두 문서
(`0-overview.md`, `data-flow/4-file-storage.md`)를 규약 관점에서 살펴본 결과, (1) 이 검토에
필요한 핵심 규약 문서(error-codes·swagger·spec-impl-evidence·migrations·node-output 등)가
예산 초과로 전부 생략되고 대신 무관한 Cafe24/MakeShop API 카탈로그 leaf 파일 수백 개가 전문
포함되어 출력 포맷·문서 구조·API 문서 규약 축의 검증이 사실상 불가능했고, (2) `0-overview.md`
§8 의 "데이터 흐름은 알파벳 순 숫자 prefix" 서술이 `13-agent-memory`~`15-external-interaction`
추가 이후 더 이상 사실과 맞지 않는 채로 방치돼 있음을 확인했다. 둘 다 이번 병합을 막을 사안은
아니지만, 전자는 다음 정식 규약 검토의 신뢰도를 갉아먹는 도구 결함이고 후자는 저비용으로 바로
고칠 수 있는 spec 정확성 이슈라 함께 기록해 둔다.

## 위험도

LOW
