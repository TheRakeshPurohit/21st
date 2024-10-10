import ComponentPage from "@/components/ComponentPage"
import React from "react"
import { notFound } from "next/navigation"
import { getComponent } from "@/utils/dataFetchers"
import { supabaseWithAdminAccess } from "@/utils/supabase"
import { generateFiles } from "@/utils/generateFiles"

export const generateMetadata = async ({
  params,
}: {
  params: { username: string; component_slug: string }
}) => {
  const { data: component } = await getComponent(
    supabaseWithAdminAccess,
    params.username,
    params.component_slug,
  )
  return {
    title: component ? `${component.name} | Component` : "Component Not Found",
  }
}

export default async function ComponentPageLayout({
  params,
}: {
  params: { username: string; component_slug: string }
}) {
  const { username, component_slug } = params

  const { data: component, error } = await getComponent(
    supabaseWithAdminAccess,
    username,
    component_slug,
  )

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (!component) {
    notFound()
  }

  const dependencies = JSON.parse(component.dependencies || "{}")
  const demoDependencies = JSON.parse(component.demo_dependencies || "{}")
  const internalDependencies = JSON.parse(
    component.internal_dependencies || "{}",
  )

  const componentAndDemoCodePromises = [
    supabaseWithAdminAccess.storage
      .from("components")
      .download(`${component.component_slug}-code.tsx`)
      .then(async ({ data, error }) => {
        if (!data || error) {
          console.error(`Error loading component code:`, error)
        }
        const code = await data!.text()
        return { data: code, error }
      }),
    supabaseWithAdminAccess.storage
      .from("components")
      .download(`${component.component_slug}-demo.tsx`)
      .then(async ({ data, error }) => {
        if (!data || error) {
          console.error(`Error loading component demo code:`, error)
        }
        const demoCode = await data!.text()
        return { data: demoCode, error }
      }),
  ]

  const internalDependenciesPromises = Object.entries(
    internalDependencies,
  ).flatMap(([path, slugs]) => {
    const slugArray = Array.isArray(slugs) ? slugs : [slugs]
    return slugArray.map(async (slug) => {
      const { data, error } = await supabaseWithAdminAccess.storage
        .from("components")
        .download(`${slug}-code.tsx`)
      if (!data || error) {
        console.error(`Error loading internal dependency ${slug}:`, error)
        return { data: null, error }
      }
      const code = await data.text()
      const fullPath = path.endsWith(".tsx") ? path : `${path}.tsx`
      return { data: { [fullPath]: code }, error: null }
    })
  })

  const [codeResult, demoResult, ...internalDependenciesResults] =
    await Promise.all([
      ...componentAndDemoCodePromises,
      ...internalDependenciesPromises,
    ])

  if (codeResult?.error || demoResult?.error) {
    return <div>Error fetching component code</div>
  }

  if (internalDependenciesResults?.find((result) => result?.error)) {
    return <div>Error fetching internal dependencies</div>
  }
  const internalDependenciesWithCode = internalDependenciesResults
    .filter((result) => typeof result?.data === "object")
    .reduce((acc, result): Record<string, string> => {
      if (result?.data && typeof result.data === 'object') {
        return { ...acc, ...result.data }
      }
      return acc
    }, {} as Record<string, string>)

  const code = codeResult?.data as string
  const rawDemoCode = demoResult?.data as string

  const componentNames = JSON.parse(component.component_name)
  const demoCode = `import { ${componentNames.join(", ")} } from "./${component.component_slug}";\n\n${rawDemoCode}`

  const demoComponentName = component.demo_component_name

  const files = generateFiles({
    demoComponentName,
    componentSlug: component.component_slug,
    code,
    demoCode,
  })

  return (
    <div className="w-full ">
      <ComponentPage
        component={component}
        files={files}
        dependencies={dependencies}
        demoDependencies={demoDependencies}
        demoComponentName={demoComponentName}
        internalDependencies={internalDependenciesWithCode}
      />
    </div>
  )
}
