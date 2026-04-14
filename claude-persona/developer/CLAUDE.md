# 폴더 구조
`Monorepo`로 구성되어 있습니다.
- 서버는 반드시 `backend`에 구성합니다.
- 클라이언트는 반드시 `frontend`에 구성합니다.

```text
./ (Root)
  ├── prd/                      # PRD(Product Requirement Document, 제품 요구 사항 정의서)
  ├── spec/                     # 프로젝트 스펙 문서 (Spec-Driven Development)
  ├── memory/                   # 당신의 기억 증강을 위해 자유롭게 사용할 수 있는 경로입니다. multi-depth tree 구조로 메모해야 할 사항 등을 적극적으로 기록하고 활용하세요.
  ├── plan/                     # spec을 작성하기 위해 당신이 해야 할 계획을 작성하세요. 사용자에게 질의할 사항, 수행 절차 등을 workflow 형태로 기록하고, 필요하다면 todo list도 작성하세요.
  ├── review/                   # 코드 리뷰
  │   ├── **/                   # 요청 시간 구분
  │   │   ├── */*.md            # 각 분야의 전문가들이 작성한 리뷰
  │   │   ├── SUMMARY.md        # 전문가들의 리뷰를 요약한 내용
  │   │   └── RESOLUTION.md     # 코드 리뷰의 이슈 조치 내용
  ├── frontend/                 # 클라이언트 (Next.js)
  │   ├── package.json
  │   ├── .env
  │   └── src/
  └── backend/                  # 서버 (Nest.js)
      ├── package.json
      ├── .env
      └── src/
```

# 개발 방법론
모든 개발은 반드시 `SDD(Spec-Driven Development)`와 `TDD(Test-Driven Development)`로 접근해야 합니다.
아래에 작성된 지침들은 **반드시 누락없이 수행하세요.**

## MEMORY
구현을 진행함에 있어서 절대 누락이 발생하면 안됩니다.
구현 이전과 이후에 `memory`, `plan` 경로에 markdown 파일을 적극적으로 작성하고 갱신하며,
작업을 매번 시작할 때마다 항상 해당 파일들을 참고하여 진행해 주세요.
(작업 후에는 결과에 맞추어 갱신하거나 제거해 주세요.)

## WORKFLOW
작업시에는 아래의 작업을 **순서대로 모두 수행**해야 합니다.
1. `prd`, `spec` 경로에 작성된 markdown 파일을 읽어서 구현해야 할 사항을 분석하세요. 
2. 모호한 내용이 존재하거나 의사결정이 필요한 사항은 대화를 진행하여 명확하게 정의하세요.
3. DOCUMENTATION을 진행하세요.
4. 스펙을 기반으로 구현 대상인 코드베이스(frontend, backend)에 테스트 코드를 작성하세요.
5. 스펙과 테스트 코드를 기반으로 구현을 진행합니다.
6. 구현된 내용을 확인하여 누락된 테스트는 테스트 코드를 추가로 작성하고, 잘못된 테스트 코드는 수정해 주세요.
7. TEST WORKFLOW를 진행하세요.
8. REVIEW WORKFLOW를 진행하세요.

## DOCUMENTATION
다음 문서를 최신화하세요.
- `prd`, `spec` 경로의 문서 
- backend swagger doc (API에 변동사항이 발생하는 경우)

## TEST WORKFLOW
다음 순서대로 진행하며, 각 단계마다 문제가 발견되면 조치하고 1의 과정부터 다시 수행하세요.
1. lint
2. unit test
3. other tests
4. build

## REVIEW WORKFLOW
1. `ai-review` 스킬을 사용하여 코드 리뷰를 진행하세요.
2. 코드 리뷰의 결과를 확인하고 발견된 이슈를 해결하세요. (Warning 이상의 이슈와 테스트 코드 누락 이슈는 반드시 해결하세요.)
3. TEST WORKFLOW를 진행하세요.

## ISSUE FIX
최우선 가치는 좋은 프로덕트를 만드는 것에 있으므로 지시받은 업무만 수행하지 말고, 전반적인 품질과 완성도를 책임져야 합니다.

- Warning 이상의 이슈와 테스트 코드 누락 이슈는 반드시 해결하세요.
- TEST WORKFLOW, REVIEW WORKFLOW에서 발견되는 사항은 기존부터 발생하던 이슈라 할지라도 반드시 해결이 필요합니다.

# 프로젝트 스펙 문서
제품의 최종 스펙을 정의한 문서입니다.
history가 아닌 latest에 대한 기술이므로 필요할 경우에는 문서를 전체적으로 정리해야 합니다.

# 코드 리뷰 결과의 조치
코드 리뷰의 이슈를 처리한 다음, **반드시** 조치 내용을 `review/**/RESOLUTION.md` 파일에 작성해 주세요.

# README.md
`README.md` 파일은 프로젝트의 제품의 설명과 실행 방법 등을 기술한 문서입니다.
구현을 완료한 후, 변동되는 사항이 있을 경우에는 `spec`을 참고하여 다시 정리해 주세요.
history가 아닌 제품의 최종 상태에 대한 내용을 작성해야 합니다.
